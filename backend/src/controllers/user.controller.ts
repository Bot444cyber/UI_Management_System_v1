import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import PrismaInstance from '../config/PrismaInstance';
import GenerateToken from '../config/module/generator/GenerateToken';
import { getIO } from '../config/socket';
import { transformToProxy } from '../utils/helpers';

// Initiate Google Login
export const googleAuth = passport.authenticate('google', {
    scope: ['profile', 'email']
});

// Handle Google Callback
export const googleAuthCallback = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
        session: true
    }, async (err: any, profile: any, info: any) => {
        console.log('🔍 Google Auth Callback Started');
        if (err) {
            console.error('❌ Google Auth Error (Passport):', err);
            return next(err);
        }

        if (!profile) {
            console.error('❌ Google Auth Error: No Profile received');
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
        }

        try {
            console.log('🔍 Processing Google Profile:', profile.id, profile.emails?.[0]?.value);

            // Check if user exists with this google_id
            let user = await PrismaInstance.user.findUnique({
                where: { google_id: profile.id },
            });

            if (!user) {
                console.log('ℹ️ User not found by Google ID, checking email...');
                // Check by email if user exists to link accounts
                if (profile.emails && profile.emails.length > 0) {
                    const existingEmailUser = await PrismaInstance.user.findUnique({
                        where: { email: profile.emails[0].value },
                    });

                    if (existingEmailUser) {
                        console.log('✅ Linking to existing email user:', existingEmailUser.user_id);
                        user = await PrismaInstance.user.update({
                            where: { user_id: existingEmailUser.user_id },
                            data: { google_id: profile.id },
                        });
                    }
                    else {
                        console.log('🆕 Creating new user from Google profile');
                        // Create new user
                        user = await PrismaInstance.user.create({
                            data: {
                                google_id: profile.id,
                                email: profile.emails[0].value,
                                full_name: profile.displayName,
                                password_hash: '',
                            },
                        });

                        // Standardize user object for dashboard
                        const formattedUser = {
                            id: user.user_id,
                            name: user.full_name,
                            email: user.email,
                            role: user.role,
                            joinedDate: user.created_at.toISOString().split('T')[0],
                            purchases: 0,
                            lifetimeValue: 0
                        };

                        // Emit real-time event
                        getIO().emit('user:new', { user: formattedUser });
                    }
                } else {
                    console.log('⚠️ No email in profile, creating fallback user');
                    // Fallback if no email (unlikely with Google)
                    user = await PrismaInstance.user.create({
                        data: {
                            google_id: profile.id,
                            email: `${profile.id}@google.oauth`, // Fallback email
                            full_name: profile.displayName,
                            password_hash: '',
                        },
                    });

                    // Standardize user object for dashboard
                    const formattedUser = {
                        id: user.user_id,
                        name: user.full_name,
                        email: user.email,
                        role: user.role,
                        joinedDate: user.created_at.toISOString().split('T')[0],
                        purchases: 0,
                        lifetimeValue: 0
                    };

                    // Emit real-time event
                    getIO().emit('user:new', { user: formattedUser });
                }
            } else {
                console.log('✅ User found by Google ID:', user.user_id);
            }

            console.log('🔐 Attempting to log in user:', user.user_id);
            req.logIn(user, (err) => {
                if (err) {
                    console.error('❌ Login Error (req.logIn):', err);
                    return next(err);
                }

                console.log('✅ Login Successful, generating token...');
                const token = GenerateToken({
                    full_name: user.full_name,
                    role: user.role,
                    user_id: user.user_id,
                    email: user.email
                });

                console.log('🚀 Redirecting to frontend...');
                // Successful authentication
                return res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
            });

        } catch (error) {
            console.error('❌ Google Auth Logic Error:', error);
            return next(error);
        }
    })(req, res, next);
};

// Logout User
export const logout = (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.status(200).json({ message: "Logged out successfully" });
    });
};

// Get Current User (for frontend session check)
export const getCurrentUser = (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true, user: req.user });
    } else {
        res.json({ isAuthenticated: false, user: null });
    }
};

// Get User Profile with Wishlist and Purchases
export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).json({ status: false, message: "Unauthorized" });
        }

        // Parse query params for pagination
        const wishlistPage = parseInt(req.query.wishlistPage as string) || 1;
        const wishlistLimit = parseInt(req.query.wishlistLimit as string) || 6;
        const paymentsPage = parseInt(req.query.paymentsPage as string) || 1;
        const paymentsLimit = parseInt(req.query.paymentsLimit as string) || 5;

        // Fetch User with basic stats
        const user = await PrismaInstance.user.findUnique({
            where: { user_id: userId },
            include: {
                _count: {
                    select: {
                        wishlists: true,
                        payments: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        // Parallel Fetch for formatted sub-data
        const [wishlists, payments] = await Promise.all([
            PrismaInstance.wishlist.findMany({
                where: { user_id: userId },
                skip: (wishlistPage - 1) * wishlistLimit,
                take: wishlistLimit,
                orderBy: { created_at: 'desc' },
                include: {
                    ui: {
                        include: {
                            creator: { select: { full_name: true } },
                            userLikes: { where: { user_id: userId } },
                            wishedBy: { where: { user_id: userId } }
                        }
                    }
                }
            }),
            PrismaInstance.payment.findMany({
                where: { userId: userId }, // Note: schema says userId (int) inside Payment model
                skip: (paymentsPage - 1) * paymentsLimit,
                take: paymentsLimit,
                orderBy: { created_at: 'desc' },
                include: { ui: true }
            })
        ]);

        // Transform Wishlist to Product format
        const wishlistData = wishlists.map(w => ({
            ...w.ui,
            imageSrc: transformToProxy(w.ui.imageSrc, req),
            liked: w.ui.userLikes.length > 0,
            wished: true, // It is in wishlist
            likes: w.ui.likes,
            fileType: w.ui.fileType
        }));

        res.json({
            status: true,
            data: {
                ...user,
                wishlist: wishlistData,
                payments: payments,
                meta: {
                    wishlist: {
                        page: wishlistPage,
                        limit: wishlistLimit,
                        total: user._count.wishlists,
                        totalPages: Math.ceil(user._count.wishlists / wishlistLimit)
                    },
                    payments: {
                        page: paymentsPage,
                        limit: paymentsLimit,
                        total: user._count.payments,
                        totalPages: Math.ceil(user._count.payments / paymentsLimit)
                    }
                }
            }
        });

    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch profile" });
    }
};
