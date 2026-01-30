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
exports.getNotifications = void 0;
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const prisma = PrismaInstance_1.default;
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { role, user_id } = user;
        const userIdInt = user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const scope = req.query.scope;
        let notifications = [];
        let total = 0;
        if (role === 'ADMIN' && scope === 'all') {
            [total, notifications] = yield Promise.all([
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
        }
        else {
            // For regular users OR Admin viewing personal notifications
            [total, notifications] = yield Promise.all([
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
    }
    catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});
exports.getNotifications = getNotifications;
