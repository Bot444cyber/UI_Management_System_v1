import { Request, Response } from 'express';
import PrismaInstance from '../config/PrismaInstance';
import { PaymentStatus, UserStatus } from '../generated/prisma';
import { transformToProxy } from '../utils/helpers';

export const getStats = async (req: Request, res: Response) => {
    try {
        // 1. Total Revenue (Sum of COMPLETED payments)
        const totalRevenueAgg = await PrismaInstance.payment.aggregate({
            _sum: {
                amount: true
            },
            where: {
                status: PaymentStatus.COMPLETED
            }
        });
        const totalRevenue = totalRevenueAgg._sum.amount || 0;

        // Calculate Revenue Change (This Month vs Last Month)
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const thisMonthRevenueAgg = await PrismaInstance.payment.aggregate({
            _sum: { amount: true },
            where: {
                created_at: { gte: startOfThisMonth },
                status: PaymentStatus.COMPLETED
            }
        });
        const thisMonthRevenue = thisMonthRevenueAgg._sum.amount || 0;

        const lastMonthRevenueAgg = await PrismaInstance.payment.aggregate({
            _sum: { amount: true },
            where: {
                created_at: { gte: startOfLastMonth, lte: endOfLastMonth },
                status: PaymentStatus.COMPLETED
            }
        });
        const lastMonthRevenue = lastMonthRevenueAgg._sum.amount || 0;

        let revenueChange = 0;
        if (lastMonthRevenue === 0) {
            revenueChange = thisMonthRevenue > 0 ? 100 : 0;
        } else {
            revenueChange = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
        }
        const revenueChangeStr = (revenueChange >= 0 ? '+' : '') + revenueChange.toFixed(1) + '%';

        // 2. Active Users
        const activeUsers = await PrismaInstance.user.count({
            where: { status: UserStatus.ACTIVE }
        });

        // 3. Live UIs
        const liveUis = await PrismaInstance.uI.count();


        // 4. Total Downloads
        const totalDownloadsAgg = await PrismaInstance.uI.aggregate({
            _sum: { downloads: true }
        });
        const totalDownloads = totalDownloadsAgg._sum.downloads || 0;

        // 5. Engagement Rate
        // Logic: (Total Likes + Comments) / Total Downloads (approximate)
        const totalLikes = await PrismaInstance.like.count();
        const totalComments = await PrismaInstance.comment.count();
        // Avoid division by zero
        const engagementRateValue = totalDownloads > 0
            ? ((totalLikes + totalComments) / totalDownloads * 100)
            : 0;

        const engagementRate = engagementRateValue.toFixed(1) + '%';

        // 6. Payment Status Distribution (For Financial Health)
        const payments = await PrismaInstance.payment.groupBy({
            by: ['status'],
            _count: {
                _all: true
            }
        });

        const paymentStats = {
            completed: 0,
            pending: 0,
            failed: 0,
            canceled: 0
        };

        payments.forEach(p => {
            if (p.status === PaymentStatus.COMPLETED) paymentStats.completed = p._count._all;
            else if (p.status === PaymentStatus.PENDING) paymentStats.pending = p._count._all;
            else if (p.status === PaymentStatus.FAILED) paymentStats.failed = p._count._all;
            else if (p.status === PaymentStatus.REFUNDED) paymentStats.canceled = p._count._all;
        });

        // 7. Recent Activity (Notifications)
        const recentActivity = await PrismaInstance.notification.findMany({
            take: 10,
            orderBy: { created_at: 'desc' },
            include: {
                user: { select: { full_name: true } },
                ui: { select: { title: true } }
            }
        });

        const formattedActivities = recentActivity.map(act => ({
            id: act.id,
            type: act.type,
            message: act.message,
            time: act.created_at,
            user: act.user?.full_name || 'System',
            uiTitle: act.ui?.title
        }));

        // 8. Graph Data (Monthly Downloads based on COMPLETED Payments)
        // Taking last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // Go back 5 months to include current month = 6 total
        sixMonthsAgo.setDate(1); // Start of that month

        const monthlyPayments = await PrismaInstance.payment.findMany({
            where: {
                created_at: {
                    gte: sixMonthsAgo
                },
                status: PaymentStatus.COMPLETED
            },
            select: {
                created_at: true
            }
        });

        // Aggregate by month
        const graphMap = new Map<string, number>();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // 9. Graph Data (Weekly Activity: Users, UIs & Revenue)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const graphData: { day: string, uis: number, users: number, volume: number, date: string }[] = [];

        // Generate last 7 days keys
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            graphData.push({
                day: days[d.getDay()], // e.g. "Mon"
                date: d.toISOString().split('T')[0], // YYYY-MM-DD for matching
                uis: 0,
                users: 0,
                volume: 0
            });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Fetch Metadata for last 7 days
        const recentUIs = await PrismaInstance.uI.findMany({
            where: { created_at: { gte: sevenDaysAgo } },
            select: { created_at: true }
        });

        const recentUsers = await PrismaInstance.user.findMany({
            where: { created_at: { gte: sevenDaysAgo } },
            select: { created_at: true }
        });

        const recentPayments = await PrismaInstance.payment.findMany({
            where: {
                created_at: { gte: sevenDaysAgo },
                status: PaymentStatus.COMPLETED
            },
            select: { created_at: true, amount: true }
        });

        // Map to graphData
        recentUIs.forEach(item => {
            const dateStr = new Date(item.created_at).toISOString().split('T')[0];
            const entry = graphData.find(g => g.date === dateStr);
            if (entry) entry.uis++;
        });

        recentUsers.forEach(item => {
            const dateStr = new Date(item.created_at).toISOString().split('T')[0];
            const entry = graphData.find(g => g.date === dateStr);
            if (entry) entry.users++;
        });

        recentPayments.forEach(item => {
            const dateStr = new Date(item.created_at).toISOString().split('T')[0];
            const entry = graphData.find(g => g.date === dateStr);
            if (entry) entry.volume += item.amount;
        });

        // Remove the 'date' field from final output if not needed, or keep it. Let's keep structure simple.
        const finalGraphData = graphData.map(({ day, uis, users, volume }) => ({ day, uis, users, volume }));

        // 10. Trending UIs
        const trendingUIs = await PrismaInstance.uI.findMany({
            take: 3,
            orderBy: { likes: 'desc' }, // or downloads
            select: {
                id: true,
                title: true,
                imageSrc: true,
                likes: true,
                downloads: true
            }
        });

        // 11. Daily Stats (Real-time for "Today")
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todayRevenueAgg = await PrismaInstance.payment.aggregate({
            _sum: { amount: true },
            where: {
                created_at: { gte: startOfToday },
                status: PaymentStatus.COMPLETED
            }
        });
        const todayRevenue = todayRevenueAgg._sum.amount || 0;

        const todayUsers = await PrismaInstance.user.count({
            where: { created_at: { gte: startOfToday } }
        });

        const todayUIs = await PrismaInstance.uI.count({
            where: { created_at: { gte: startOfToday } }
        });

        const dailyStats = {
            revenue: todayRevenue,
            revenueGoal: 1000, // Hardcoded goal for demo
            users: todayUsers,
            usersGoal: 10,
            uis: todayUIs,
            uisGoal: 5
        };

        // 12. Intraday Graph Data (Hourly breakdown for today)
        const hourlyStats: { day: string, uis: number, users: number, volume: number }[] = [];

        // Fetch raw data for today to aggregate in memory (efficient for daily range)
        const todayPayments = await PrismaInstance.payment.findMany({
            where: { created_at: { gte: startOfToday }, status: PaymentStatus.COMPLETED },
            select: { created_at: true, amount: true }
        });

        const todayUsersList = await PrismaInstance.user.findMany({
            where: { created_at: { gte: startOfToday } },
            select: { created_at: true }
        });

        const todayUIsList = await PrismaInstance.uI.findMany({
            where: { created_at: { gte: startOfToday } },
            select: { created_at: true }
        });

        // Generate buckets for 00:00 to 23:00
        for (let i = 0; i < 24; i++) {
            const hourLabel = `${i.toString().padStart(2, '0')}:00`;

            // Filter counts for this hour
            const usersCount = todayUsersList.filter(u => new Date(u.created_at).getHours() === i).length;
            const uisCount = todayUIsList.filter(u => new Date(u.created_at).getHours() === i).length;
            const revenueSum = todayPayments
                .filter(p => new Date(p.created_at).getHours() === i)
                .reduce((acc, curr) => acc + curr.amount, 0);

            hourlyStats.push({
                day: hourLabel, // reusing 'day' key for XAxis compatibility with existing types/chart
                users: usersCount,
                uis: uisCount,
                volume: revenueSum
            });
        }

        res.status(200).json({
            status: true,
            data: {
                stats: [
                    { label: 'Total Revenue', value: totalRevenue.toLocaleString(), change: revenueChangeStr, color: 'emerald' },
                    { label: 'Active Users', value: activeUsers < 1000 ? activeUsers.toString() : (activeUsers / 1000).toFixed(1) + 'k', change: '+0', color: 'indigo' },
                    { label: 'Live UIs', value: liveUis.toString(), change: '+5.1%', color: 'amber' },
                    { label: 'Engagement Rate', value: engagementRate, change: '+1.2%', color: 'rose' },
                ],
                graphData: finalGraphData,
                hourlyStats,
                trendingUIs: trendingUIs.map(ui => ({
                    ...ui,
                    imageSrc: transformToProxy(ui.imageSrc, req)
                })),
                dailyStats,
                paymentStatusDistribution: paymentStats,
                formattedActivities
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};
