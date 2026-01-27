
import { PrismaClient, Role, UserStatus, NotificationType, PaymentStatus } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Clean Database (Delete in order of dependency)
    await prisma.notification.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.like.deleteMany();
    await prisma.wishlist.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.uI.deleteMany();
    await prisma.user.deleteMany();

    console.log('🧹 Database cleaned');

    // 2. Create Users
    const adminHash = "$2b$10$EpWaTgi/F.vjZ.X.Z.X.Z.X.Z.X.Z.X.Z.X.Z.X.Z.X.Z.X.Z"; // Placeholder hash

    const admin = await prisma.user.create({
        data: {
            full_name: 'Admin User',
            email: 'admin@lumina.ui',
            password_hash: adminHash,
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
        }
    });

    const user1 = await prisma.user.create({
        data: { full_name: 'John Design', email: 'john@design.co', role: Role.CUSTOMER, status: UserStatus.ACTIVE }
    });
    const user2 = await prisma.user.create({
        data: { full_name: 'Sarah Creative', email: 'sarah@studio.io', role: Role.CUSTOMER, status: UserStatus.ACTIVE }
    });
    const user3 = await prisma.user.create({
        data: { full_name: 'Mike Dev', email: 'mike@code.dev', role: Role.CUSTOMER, status: UserStatus.ACTIVE }
    });

    console.log('👤 Users created');

    // 3. Create UIs
    const uis = await Promise.all([
        // E-Commerce
        prisma.uI.create({
            data: {
                title: 'Modern Shop Kit', price: '$49', author: 'Lumina Team', category: 'E-Commerce',
                imageSrc: 'https://images.unsplash.com/photo-1472851294608-4155f21cf8c0?auto=format&fit=crop&q=80',
                tags: ['shop', 'retail', 'modern'], highlights: ['15+ Screens', 'Auto Layout'],
                rating: 4.9, downloads: 1240, likes: 230,
                creatorId: admin.user_id
            }
        }),
        prisma.uI.create({
            data: {
                title: 'Cart & Checkout Flow', price: '$29', author: 'UI Pros', category: 'E-Commerce',
                imageSrc: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80',
                tags: ['checkout', 'payment'], highlights: ['Smooth Logic', 'Responsive'],
                rating: 4.7, downloads: 850, likes: 120,
                creatorId: admin.user_id
            }
        }),
        // SaaS
        prisma.uI.create({
            data: {
                title: 'SaaS Analytics Pro', price: '$89', author: 'Lumina Team', category: 'SaaS',
                imageSrc: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80',
                tags: ['analytics', 'charts', 'dashboard'], highlights: ['Dark Mode', 'Real-time Data'],
                rating: 5.0, downloads: 2100, likes: 540,
                creatorId: admin.user_id
            }
        }),
        prisma.uI.create({
            data: {
                title: 'Project Manager App', price: '$59', author: 'Mike Dev', category: 'SaaS',
                imageSrc: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80',
                tags: ['kanban', 'tasks'], highlights: ['Drag & Drop', 'Team View'],
                rating: 4.5, downloads: 430, likes: 85,
                creatorId: admin.user_id
            }
        }),
        // Dashboard
        prisma.uI.create({
            data: {
                title: 'Admin One Hub', price: '$69', author: 'Lumina Team', category: 'Dashboard',
                imageSrc: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80',
                tags: ['admin', 'control'], highlights: ['Next.js Ready', 'Tailwind'],
                rating: 4.8, downloads: 1540, likes: 310,
                creatorId: admin.user_id
            }
        }),
        prisma.uI.create({
            data: {
                title: 'Crypto Wallet Dash', price: '$79', author: 'Sarah Creative', category: 'Dashboard',
                imageSrc: 'https://images.unsplash.com/photo-1621504450168-38f64731993e?auto=format&fit=crop&q=80',
                tags: ['crypto', 'finance'], highlights: ['Web3 Ready', 'Sleek'],
                rating: 4.9, downloads: 980, likes: 410,
                creatorId: admin.user_id
            }
        }),
        // Landing Page
        prisma.uI.create({
            data: {
                title: 'Startup Launchpad', price: 'Free', author: 'Lumina Team', category: 'Landing Page',
                imageSrc: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?auto=format&fit=crop&q=80',
                tags: ['hero', 'marketing'], highlights: ['High Conversion', 'SEO Friendly'],
                rating: 4.6, downloads: 6500, likes: 890,
                creatorId: admin.user_id
            }
        }),
    ]);

    console.log('🖼️ UIs created');

    // 4. Create Payments & Notifications (Recent Activity)
    // User 1 buys Modern Shop Kit
    await prisma.payment.create({
        data: {
            amount: 49, status: PaymentStatus.COMPLETED, userId: user1.user_id, uiId: uis[0].id
        }
    });
    await prisma.notification.create({
        data: {
            type: NotificationType.PAYMENT, message: `purchased ${uis[0].title}`, userId: admin.user_id, uiId: uis[0].id
        }
    });

    // User 2 buys SaaS Analytics
    await prisma.payment.create({
        data: {
            amount: 89, status: PaymentStatus.COMPLETED, userId: user2.user_id, uiId: uis[2].id
        }
    });
    await prisma.notification.create({
        data: {
            type: NotificationType.PAYMENT, message: `purchased ${uis[2].title}`, userId: admin.user_id, uiId: uis[2].id
        }
    });

    // User 3 likes Crypto Wallet
    await prisma.like.create({
        data: { user_id: user3.user_id, ui_id: uis[5].id }
    });
    await prisma.notification.create({
        data: {
            type: NotificationType.LIKE, message: `liked ${uis[5].title}`, userId: admin.user_id, uiId: uis[5].id
        }
    });

    console.log('💰 Payments & Interactions created');
    console.log('✅ Seed completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
