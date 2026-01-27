"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = exports.getCurrentUser = exports.logout = exports.googleAuthCallback = exports.googleAuth = void 0;
const passport_1 = __importDefault(require("passport"));
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const GenerateToken_1 = __importDefault(require("../config/module/generator/GenerateToken"));
const socket_1 = require("../config/socket");
const helpers_1 = require("../utils/helpers");
// Initiate Google Login
exports.googleAuth = passport_1.default.authenticate('google', {
    scope: ['profile', 'email']
});
// Handle Google Callback
const googleAuthCallback = (req, res, next) => {
    passport_1.default.authenticate('google', {
        failureRedirect: 'http://localhost:3000/login?error=auth_failed', // Redirect to frontend login on failure
        session: true
    }, (err, profile, info) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        console.log('🔍 Google Auth Callback Started');
        if (err) {
            console.error('❌ Google Auth Error (Passport):', err);
            return next(err);
        }
        if (!profile) {
            console.error('❌ Google Auth Error: No Profile received');
            return res.redirect('http://localhost:3000/login?error=no_user');
        }
        try {
            console.log('🔍 Processing Google Profile:', profile.id, (_b = (_a = profile.emails) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value);
            // Check if user exists with this google_id
            let user = yield PrismaInstance_1.default.user.findUnique({
                where: { google_id: profile.id },
            });
            if (!user) {
                console.log('ℹ️ User not found by Google ID, checking email...');
                // Check by email if user exists to link accounts
                if (profile.emails && profile.emails.length > 0) {
                    const existingEmailUser = yield PrismaInstance_1.default.user.findUnique({
                        where: { email: profile.emails[0].value },
                    });
                    if (existingEmailUser) {
                        console.log('✅ Linking to existing email user:', existingEmailUser.user_id);
                        user = yield PrismaInstance_1.default.user.update({
                            where: { user_id: existingEmailUser.user_id },
                            data: { google_id: profile.id },
                        });
                    }
                    else {
                        console.log('🆕 Creating new user from Google profile');
                        // Create new user
                        user = yield PrismaInstance_1.default.user.create({
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
                        (0, socket_1.getIO)().emit('user:new', { user: formattedUser });
                    }
                }
                else {
                    console.log('⚠️ No email in profile, creating fallback user');
                    // Fallback if no email (unlikely with Google)
                    user = yield PrismaInstance_1.default.user.create({
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
                    (0, socket_1.getIO)().emit('user:new', { user: formattedUser });
                }
            }
            else {
                console.log('✅ User found by Google ID:', user.user_id);
            }
            console.log('🔐 Attempting to log in user:', user.user_id);
            req.logIn(user, (err) => {
                if (err) {
                    console.error('❌ Login Error (req.logIn):', err);
                    return next(err);
                }
                console.log('✅ Login Successful, generating token...');
                const token = (0, GenerateToken_1.default)({
                    full_name: user.full_name,
                    role: user.role,
                    user_id: user.user_id,
                    email: user.email
                });
                console.log('🚀 Redirecting to frontend...');
                // Successful authentication
                return res.redirect(`http://localhost:3000?token=${token}`);
            });
        }
        catch (error) {
            console.error('❌ Google Auth Logic Error:', error);
            return next(error);
        }
    }))(req, res, next);
};
exports.googleAuthCallback = googleAuthCallback;
// Logout User
const logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.status(200).json({ message: "Logged out successfully" });
    });
};
exports.logout = logout;
// Get Current User (for frontend session check)
const getCurrentUser = (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true, user: req.user });
    }
    else {
        res.json({ isAuthenticated: false, user: null });
    }
};
exports.getCurrentUser = getCurrentUser;
// Get User Profile with Wishlist and Purchases
const getUserProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        if (!userId) {
            return res.status(401).json({ status: false, message: "Unauthorized" });
        }
        // Parse query params for pagination
        const wishlistPage = parseInt(req.query.wishlistPage) || 1;
        const wishlistLimit = parseInt(req.query.wishlistLimit) || 6;
        const paymentsPage = parseInt(req.query.paymentsPage) || 1;
        const paymentsLimit = parseInt(req.query.paymentsLimit) || 5;
        // Fetch User with basic stats
        const user = yield PrismaInstance_1.default.user.findUnique({
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
        const [wishlists, payments] = yield Promise.all([
            PrismaInstance_1.default.wishlist.findMany({
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
            PrismaInstance_1.default.payment.findMany({
                where: { userId: userId }, // Note: schema says userId (int) inside Payment model
                skip: (paymentsPage - 1) * paymentsLimit,
                take: paymentsLimit,
                orderBy: { created_at: 'desc' },
                include: { ui: true }
            })
        ]);
        // Transform Wishlist to Product format
        const wishlistData = wishlists.map(w => (Object.assign(Object.assign({}, w.ui), { imageSrc: (0, helpers_1.transformToProxy)(w.ui.imageSrc, req), liked: w.ui.userLikes.length > 0, wished: true, likes: w.ui.likes, fileType: w.ui.fileType })));
        res.json({
            status: true,
            data: Object.assign(Object.assign({}, user), { wishlist: wishlistData, payments: payments, meta: {
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
                } })
        });
    }
    catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch profile" });
    }
});
exports.getUserProfile = getUserProfile;
