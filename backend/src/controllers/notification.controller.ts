
import { Request, Response } from 'express';
import PrismaInstance from '../config/PrismaInstance';
const prisma = PrismaInstance;

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { role, user_id } = user;
        const userIdInt = user_id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const scope = req.query.scope as string;
        let notifications: any[] = [];
        let total = 0;

        if (role === 'ADMIN' && scope === 'all') {
            [total, notifications] = await Promise.all([
                prisma.notification.count(),
                prisma.notification.findMany({
                    orderBy: { created_at: 'desc' },
                    include: {
                        user: {
                            select: { full_name: true, email: true, user_id: true }
                        },
                        ui: {
                            select: { title: true, id: true }
                        }
                    },
                    skip,
                    take: limit
                })
            ]);
        } else {
            // For regular users OR Admin viewing personal notifications
            [total, notifications] = await Promise.all([
                prisma.notification.count({ where: { userId: userIdInt } }),
                prisma.notification.findMany({
                    where: { userId: userIdInt },
                    orderBy: { created_at: 'desc' },
                    include: {
                        ui: {
                            select: { title: true, id: true }
                        }
                    },
                    skip,
                    take: limit
                })
            ]);
        }

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            status: true,
            data: notifications,
            meta: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};
