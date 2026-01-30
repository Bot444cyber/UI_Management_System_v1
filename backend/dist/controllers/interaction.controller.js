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
exports.deleteComment = exports.getComments = exports.addComment = exports.toggleWishlist = exports.toggleLike = void 0;
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const socket_1 = require("../config/socket");
// Toggle Like
const toggleLike = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        if (!userId)
            return res.status(401).json({ status: false, message: "Unauthorized" });
        if (!userId)
            return res.status(401).json({ status: false, message: "Unauthorized" });
        // Fetch user details for notification
        const userDetails = yield PrismaInstance_1.default.user.findUnique({
            where: { user_id: userId },
            select: { full_name: true, email: true }
        });
        const existingLike = yield PrismaInstance_1.default.like.findUnique({
            where: {
                user_id_ui_id: {
                    user_id: userId,
                    ui_id: id
                }
            }
        });
        if (existingLike) {
            // Unlike
            yield PrismaInstance_1.default.like.delete({
                where: { id: existingLike.id }
            });
            const updatedUI = yield PrismaInstance_1.default.uI.update({
                where: { id },
                data: { likes: { decrement: 1 } }
            });
            // Emit real-time update
            (0, socket_1.getIO)().emit('like:updated', { uiId: id, likesCount: updatedUI.likes, liked: false, userId });
            return res.json({ status: true, message: "Unliked", liked: false, likesCount: updatedUI.likes });
        }
        else {
            // Like
            yield PrismaInstance_1.default.like.create({
                data: {
                    user_id: userId,
                    ui_id: id
                }
            });
            const updatedUI = yield PrismaInstance_1.default.uI.update({
                where: { id },
                data: { likes: { increment: 1 } }
            });
            // Create Notification
            try {
                const notification = yield PrismaInstance_1.default.notification.create({
                    data: {
                        type: 'LIKE',
                        message: `${(userDetails === null || userDetails === void 0 ? void 0 : userDetails.full_name) || 'User'} liked UI: ${updatedUI.title}`,
                        userId: userId,
                        uiId: id,
                        isRead: false
                    }
                });
                const payload = {
                    id: notification.id,
                    type: 'LIKE',
                    message: `${(userDetails === null || userDetails === void 0 ? void 0 : userDetails.full_name) || 'User'} liked UI: ${updatedUI.title}`,
                    userId: userId,
                    uiId: id,
                    user: userDetails,
                    ui: { title: updatedUI.title }
                };
                (0, socket_1.getIO)().to(userId.toString()).emit('new-notification', payload);
                (0, socket_1.getIO)().to('admin').emit('new-notification', payload);
            }
            catch (err) {
                console.error("Notification error", err);
            }
            // Emit real-time update
            (0, socket_1.getIO)().emit('like:updated', { uiId: id, likesCount: updatedUI.likes, liked: true, userId });
            return res.json({ status: true, message: "Liked", liked: true, likesCount: updatedUI.likes });
        }
    }
    catch (error) {
        console.error("Toggle Like Error:", error);
        res.status(500).json({ status: false, message: "Action failed" });
    }
});
exports.toggleLike = toggleLike;
// Toggle Wishlist
const toggleWishlist = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        if (!userId)
            return res.status(401).json({ status: false, message: "Unauthorized" });
        const existingWish = yield PrismaInstance_1.default.wishlist.findUnique({
            where: {
                user_id_ui_id: {
                    user_id: userId,
                    ui_id: id
                }
            }
        });
        // Fetch user details for notification (recycle if possible, but safe to fetch here if not above)
        // Since this is a separate function, we need to fetch again or reuse logic.
        const userDetails = yield PrismaInstance_1.default.user.findUnique({
            where: { user_id: userId },
            select: { full_name: true, email: true }
        });
        if (existingWish) {
            yield PrismaInstance_1.default.wishlist.delete({
                where: { id: existingWish.id }
            });
            // Emit real-time update
            (0, socket_1.getIO)().emit('wishlist:updated', { uiId: id, wished: false, userId });
            return res.json({ status: true, message: "Removed from wishlist", wished: false });
        }
        else {
            yield PrismaInstance_1.default.wishlist.create({
                data: {
                    user_id: userId,
                    ui_id: id
                }
            });
            // Create Notification
            try {
                // Fetch UI title for message
                const ui = yield PrismaInstance_1.default.uI.findUnique({ where: { id }, select: { title: true } });
                const notification = yield PrismaInstance_1.default.notification.create({
                    data: {
                        type: 'WISHLIST',
                        message: `${(userDetails === null || userDetails === void 0 ? void 0 : userDetails.full_name) || 'User'} added to wishlist: ${(ui === null || ui === void 0 ? void 0 : ui.title) || id}`,
                        userId: userId,
                        uiId: id,
                        isRead: false
                    }
                });
                const payload = {
                    id: notification.id,
                    type: 'WISHLIST',
                    message: `${(userDetails === null || userDetails === void 0 ? void 0 : userDetails.full_name) || 'User'} added to wishlist: ${(ui === null || ui === void 0 ? void 0 : ui.title) || id}`,
                    userId: userId,
                    uiId: id,
                    user: userDetails,
                    ui: { title: ui === null || ui === void 0 ? void 0 : ui.title }
                };
                (0, socket_1.getIO)().to(userId.toString()).emit('new-notification', payload);
                (0, socket_1.getIO)().to('admin').emit('new-notification', payload);
            }
            catch (err) {
                console.error("Notification error", err);
            }
            // Emit real-time update
            (0, socket_1.getIO)().emit('wishlist:updated', { uiId: id, wished: true, userId });
            return res.json({ status: true, message: "Added to wishlist", wished: true });
        }
    }
    catch (error) {
        console.error("Toggle Wishlist Error:", error);
        res.status(500).json({ status: false, message: "Action failed" });
    }
});
exports.toggleWishlist = toggleWishlist;
// Add Comment
const addComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params; // UI ID
        const { content } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        if (!userId)
            return res.status(401).json({ status: false, message: "Unauthorized" });
        if (!content || !content.trim())
            return res.status(400).json({ status: false, message: "Content required" });
        const comment = yield PrismaInstance_1.default.comment.create({
            data: {
                content,
                user_id: userId,
                ui_id: id
            },
            include: {
                user: { select: { full_name: true, email: true } }
            }
        });
        // Create Notification
        try {
            // Fetch UI title
            const ui = yield PrismaInstance_1.default.uI.findUnique({ where: { id }, select: { title: true } });
            const notification = yield PrismaInstance_1.default.notification.create({
                data: {
                    type: 'COMMENT',
                    message: `${comment.user.full_name || 'User'} commented on: ${(ui === null || ui === void 0 ? void 0 : ui.title) || id}`,
                    userId: userId,
                    uiId: id,
                    isRead: false
                }
            });
            const payload = {
                id: notification.id,
                type: 'COMMENT',
                message: `${comment.user.full_name || 'User'} commented on: ${(ui === null || ui === void 0 ? void 0 : ui.title) || id}`,
                userId: userId,
                uiId: id,
                user: comment.user, // comment include already has user
                ui: { title: ui === null || ui === void 0 ? void 0 : ui.title }
            };
            (0, socket_1.getIO)().to(userId.toString()).emit('new-notification', payload);
            (0, socket_1.getIO)().to('admin').emit('new-notification', payload);
        }
        catch (err) {
            console.error("Notification error", err);
        }
        // Emit real-time update
        (0, socket_1.getIO)().emit('comment:added', { uiId: id, comment });
        res.json({ status: true, message: "Comment added", data: comment });
    }
    catch (error) {
        console.error("Add Comment Error:", error);
        res.status(500).json({ status: false, message: "Failed to add comment" });
    }
});
exports.addComment = addComment;
// Get Comments
const getComments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [total, comments] = yield Promise.all([
            PrismaInstance_1.default.comment.count({ where: { ui_id: id } }),
            PrismaInstance_1.default.comment.findMany({
                where: { ui_id: id },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    user: { select: { full_name: true, email: true } }
                }
            })
        ]);
        const totalPages = Math.ceil(total / limit);
        res.json({
            status: true,
            data: comments,
            meta: {
                page,
                limit,
                total,
                totalPages
            }
        });
    }
    catch (error) {
        console.error("Get Comments Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch comments" });
    }
});
exports.getComments = getComments;
// Delete Comment
const deleteComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { commentId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        const comment = yield PrismaInstance_1.default.comment.findUnique({ where: { id: commentId } });
        if (!comment)
            return res.status(404).json({ status: false, message: "Comment not found" });
        if (comment.user_id !== userId) {
            return res.status(403).json({ status: false, message: "Unauthorized" });
        }
        yield PrismaInstance_1.default.comment.delete({ where: { id: commentId } });
        res.json({ status: true, message: "Comment deleted" });
    }
    catch (error) {
        console.error("Delete Comment Error:", error);
        res.status(500).json({ status: false, message: "Failed to delete comment" });
    }
});
exports.deleteComment = deleteComment;
