import { Request, Response } from 'express';
import PrismaInstance from '../config/PrismaInstance';
import { getIO } from '../config/socket';

// Toggle Like
export const toggleLike = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.user_id;

        if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });

        if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });

        // Fetch user details for notification
        const userDetails = await PrismaInstance.user.findUnique({
            where: { user_id: userId },
            select: { full_name: true, email: true }
        });

        const existingLike = await PrismaInstance.like.findUnique({
            where: {
                user_id_ui_id: {
                    user_id: userId,
                    ui_id: id
                }
            }
        });

        if (existingLike) {
            // Unlike
            await PrismaInstance.like.delete({
                where: { id: existingLike.id }
            });
            const updatedUI = await PrismaInstance.uI.update({
                where: { id },
                data: { likes: { decrement: 1 } }
            });

            // Emit real-time update
            getIO().emit('like:updated', { uiId: id, likesCount: updatedUI.likes, liked: false, userId });

            return res.json({ status: true, message: "Unliked", liked: false, likesCount: updatedUI.likes });
        } else {
            // Like
            await PrismaInstance.like.create({
                data: {
                    user_id: userId,
                    ui_id: id
                }
            });
            const updatedUI = await PrismaInstance.uI.update({
                where: { id },
                data: { likes: { increment: 1 } }
            });

            // Create Notification
            try {
                const notification = await PrismaInstance.notification.create({
                    data: {
                        type: 'LIKE',
                        message: `${userDetails?.full_name || 'User'} liked UI: ${updatedUI.title}`,
                        userId: userId,
                        uiId: id,
                        isRead: false
                    }
                });

                const payload = {
                    id: notification.id,
                    type: 'LIKE',
                    message: `${userDetails?.full_name || 'User'} liked UI: ${updatedUI.title}`,
                    userId: userId,
                    uiId: id,
                    user: userDetails,
                    ui: { title: updatedUI.title }
                };
                getIO().to(userId.toString()).emit('new-notification', payload);
                getIO().to('admin').emit('new-notification', payload);
            } catch (err) {
                console.error("Notification error", err);
            }

            // Emit real-time update
            getIO().emit('like:updated', { uiId: id, likesCount: updatedUI.likes, liked: true, userId });

            return res.json({ status: true, message: "Liked", liked: true, likesCount: updatedUI.likes });
        }
    } catch (error) {
        console.error("Toggle Like Error:", error);
        res.status(500).json({ status: false, message: "Action failed" });
    }
};

// Toggle Wishlist
export const toggleWishlist = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.user_id;

        if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });

        const existingWish = await PrismaInstance.wishlist.findUnique({
            where: {
                user_id_ui_id: {
                    user_id: userId,
                    ui_id: id
                }
            }
        });

        // Fetch user details for notification (recycle if possible, but safe to fetch here if not above)
        // Since this is a separate function, we need to fetch again or reuse logic.
        const userDetails = await PrismaInstance.user.findUnique({
            where: { user_id: userId },
            select: { full_name: true, email: true }
        });

        if (existingWish) {
            await PrismaInstance.wishlist.delete({
                where: { id: existingWish.id }
            });
            // Emit real-time update
            getIO().emit('wishlist:updated', { uiId: id, wished: false, userId });

            return res.json({ status: true, message: "Removed from wishlist", wished: false });
        } else {
            await PrismaInstance.wishlist.create({
                data: {
                    user_id: userId,
                    ui_id: id
                }
            });

            // Create Notification
            try {
                // Fetch UI title for message
                const ui = await PrismaInstance.uI.findUnique({ where: { id }, select: { title: true } });
                const notification = await PrismaInstance.notification.create({
                    data: {
                        type: 'WISHLIST',
                        message: `${userDetails?.full_name || 'User'} added to wishlist: ${ui?.title || id}`,
                        userId: userId,
                        uiId: id,
                        isRead: false
                    }
                });

                const payload = {
                    id: notification.id,
                    type: 'WISHLIST',
                    message: `${userDetails?.full_name || 'User'} added to wishlist: ${ui?.title || id}`,
                    userId: userId,
                    uiId: id,
                    user: userDetails,
                    ui: { title: ui?.title }
                };
                getIO().to(userId.toString()).emit('new-notification', payload);
                getIO().to('admin').emit('new-notification', payload);
            } catch (err) {
                console.error("Notification error", err);
            }

            // Emit real-time update
            getIO().emit('wishlist:updated', { uiId: id, wished: true, userId });

            return res.json({ status: true, message: "Added to wishlist", wished: true });
        }

    } catch (error) {
        console.error("Toggle Wishlist Error:", error);
        res.status(500).json({ status: false, message: "Action failed" });
    }
};

// Add Comment
export const addComment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // UI ID
        const { content } = req.body;
        const userId = req.user?.user_id;

        if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });
        if (!content || !content.trim()) return res.status(400).json({ status: false, message: "Content required" });

        const comment = await PrismaInstance.comment.create({
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
            const ui = await PrismaInstance.uI.findUnique({ where: { id }, select: { title: true } });
            const notification = await PrismaInstance.notification.create({
                data: {
                    type: 'COMMENT',
                    message: `${comment.user.full_name || 'User'} commented on: ${ui?.title || id}`,
                    userId: userId,
                    uiId: id,
                    isRead: false
                }
            });

            const payload = {
                id: notification.id,
                type: 'COMMENT',
                message: `${comment.user.full_name || 'User'} commented on: ${ui?.title || id}`,
                userId: userId,
                uiId: id,
                user: comment.user, // comment include already has user
                ui: { title: ui?.title }
            };
            getIO().to(userId.toString()).emit('new-notification', payload);
            getIO().to('admin').emit('new-notification', payload);
        } catch (err) {
            console.error("Notification error", err);
        }

        // Emit real-time update
        getIO().emit('comment:added', { uiId: id, comment });

        res.json({ status: true, message: "Comment added", data: comment });
    } catch (error) {
        console.error("Add Comment Error:", error);
        res.status(500).json({ status: false, message: "Failed to add comment" });
    }
};

// Get Comments
export const getComments = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const [total, comments] = await Promise.all([
            PrismaInstance.comment.count({ where: { ui_id: id } }),
            PrismaInstance.comment.findMany({
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
    } catch (error) {
        console.error("Get Comments Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch comments" });
    }
};

// Delete Comment
export const deleteComment = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.user?.user_id;

        const comment = await PrismaInstance.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ status: false, message: "Comment not found" });

        if (comment.user_id !== userId) {
            return res.status(403).json({ status: false, message: "Unauthorized" });
        }

        await PrismaInstance.comment.delete({ where: { id: commentId } });
        res.json({ status: true, message: "Comment deleted" });
    } catch (error) {
        console.error("Delete Comment Error:", error);
        res.status(500).json({ status: false, message: "Failed to delete comment" });
    }
};


