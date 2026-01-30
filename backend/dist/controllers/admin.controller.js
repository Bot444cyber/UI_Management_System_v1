"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.resetData = exports.getRecentActivity = exports.getAllPayments = exports.getAllUsers = exports.getOverviewStats = void 0;
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const googleapis_1 = require("googleapis");
const dashboard_controller_1 = require("./dashboard.controller"); // Import getStats
// Helper to extract file ID from Drive URL (reused from ui.controller logic or similar)
const extractDriveFileId = (url) => {
    if (!url)
        return null;
    const idMatch = url.match(/[?&]id=([^&]+)/i);
    if (idMatch && idMatch[1])
        return idMatch[1];
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch && dMatch[1])
        return dMatch[1];
    return null;
};
// Batch delete files from Drive
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Helper for debug logging
const logToDebug = (message) => {
    const logPath = path.join(__dirname, '../../logs/drive_reset.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    // Ensure directory exists
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    try {
        fs.appendFileSync(logPath, logMessage);
    }
    catch (e) {
        console.error("Failed to write to debug log:", e);
    }
};
const deleteFilesFromDrive = (fileIds) => __awaiter(void 0, void 0, void 0, function* () {
    if (fileIds.length === 0)
        return;
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const msgInit = `[Drive Reset] Initializing deletion for ${fileIds.length} files...`;
    console.log(msgInit);
    logToDebug(msgInit);
    if (!clientId || !clientSecret || !refreshToken) {
        const msgErr = "[Drive Reset] CRITICAL: Missing OAuth Credentials";
        console.error(msgErr);
        logToDebug(msgErr);
        return;
    }
    try {
        const auth = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
        auth.setCredentials({ refresh_token: refreshToken });
        const drive = googleapis_1.google.drive({ version: 'v3', auth });
        const msgAuth = `[Drive Reset] Auth initialized. Starting batch deletion...`;
        console.log(msgAuth);
        logToDebug(msgAuth);
        const batchSize = 5;
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < fileIds.length; i += batchSize) {
            const batch = fileIds.slice(i, i + batchSize);
            const results = yield Promise.allSettled(batch.map(id => drive.files.delete({ fileId: id })));
            results.forEach((res, index) => {
                var _a;
                const id = batch[index];
                if (res.status === 'fulfilled') {
                    const msg = `[Drive Reset] Successfully deleted file: ${id}`;
                    console.log(msg);
                    logToDebug(msg);
                    successCount++;
                }
                else {
                    const msg = `[Drive Reset] Failed to delete file ${id}: ${((_a = res.reason) === null || _a === void 0 ? void 0 : _a.message) || res.reason}`;
                    console.error(msg);
                    logToDebug(msg);
                    failCount++;
                }
            });
        }
        const msgComplete = `[Drive Reset] Completed. Success: ${successCount}, Failed: ${failCount}`;
        console.log(msgComplete);
        logToDebug(msgComplete);
    }
    catch (error) {
        const fatalErr = `[Drive Reset] Fatal Error: ${error.message}`;
        console.error(fatalErr);
        logToDebug(fatalErr);
    }
});
// --- Missing Exports Implementation ---
exports.getOverviewStats = dashboard_controller_1.getStats;
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield PrismaInstance_1.default.user.findMany({
            orderBy: { created_at: 'desc' },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                status: true,
                created_at: true
            }
        });
        res.json({ status: true, data: users });
    }
    catch (error) {
        console.error("Get All Users Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch users" });
    }
});
exports.getAllUsers = getAllUsers;
const getAllPayments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payments = yield PrismaInstance_1.default.payment.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                user: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true
                    }
                },
                ui: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        });
        res.json({ status: true, data: payments });
    }
    catch (error) {
        console.error("Get All Payments Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch payments" });
    }
});
exports.getAllPayments = getAllPayments;
const getRecentActivity = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const activity = yield PrismaInstance_1.default.notification.findMany({
            take: 50,
            orderBy: { created_at: 'desc' },
            include: {
                user: { select: { full_name: true } },
                ui: { select: { title: true } }
            }
        });
        res.json({ status: true, data: activity });
    }
    catch (error) {
        console.error("Get Recent Activity Error:", error);
        res.status(500).json({ status: false, message: "Failed to fetch activity" });
    }
});
exports.getRecentActivity = getRecentActivity;
const resetData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const requestingUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        // Double check admin role
        const user = yield PrismaInstance_1.default.user.findUnique({ where: { user_id: requestingUserId } });
        if (!user || user.role !== 'ADMIN') {
            return res.status(403).json({ status: false, message: "Unauthorized" });
        }
        const { options } = req.body;
        // Default to all true if no options provided (legacy support), or strictly enforce options. 
        // Let's default to full reset if empty to keep simple API usage valid, but frontend will send specific options.
        const targets = options || {
            uis: true,
            drive: true,
            users: true,
            payments: true,
            social: true,
            notifications: true
        };
        console.log("Starting System Reset with targets:", targets);
        const transactionOperations = [];
        // 1. Handle Google Drive Files
        // Trigger if explicit Drive reset is requested OR if UIs are being deleted (cleanup assets)
        if (targets.drive || targets.uis) {
            // We need to fetch all UIs to get their file IDs, regardless of whether we are deleting the UI records from DB or not.
            // If we are deleting UIs (targets.uis=true), this usually happens anyway, but if we ONLY want to wipe Drive options, we fetch here.
            const allUIs = yield PrismaInstance_1.default.uI.findMany({ select: { google_file_id: true, imageSrc: true, showcase: true } });
            let fileIdsToDelete = [];
            for (const ui of allUIs) {
                if (ui.google_file_id)
                    fileIdsToDelete.push(ui.google_file_id);
                const bannerId = extractDriveFileId(ui.imageSrc);
                if (bannerId)
                    fileIdsToDelete.push(bannerId);
                if (ui.showcase && Array.isArray(ui.showcase)) {
                    ui.showcase.forEach((url) => {
                        const sId = extractDriveFileId(url);
                        if (sId)
                            fileIdsToDelete.push(sId);
                    });
                }
            }
            // Deduplicate IDs
            fileIdsToDelete = [...new Set(fileIdsToDelete)];
            console.log(`[Drive Reset] Found ${fileIdsToDelete.length} unique file IDs to delete from ${allUIs.length} UIs.`);
            // Delete from Drive
            if (fileIdsToDelete.length > 0) {
                yield deleteFilesFromDrive(fileIdsToDelete);
            }
            else {
                console.log("[Drive Reset] No file IDs found to delete.");
            }
        }
        // 2. Handle UIs (Table Data)
        if (targets.uis) {
            // Delete UIs (will cascade to Payments, Likes, Comments, Wishlists, Notifications linked to these UIs)
            transactionOperations.push(PrismaInstance_1.default.uI.deleteMany({}));
        }
        // 2. Handle Users
        if (targets.users) {
            // Delete Users EXCEPT the requesting Admin
            // This will cascade to their Payments, Likes, Comments, etc.
            transactionOperations.push(PrismaInstance_1.default.user.deleteMany({
                where: {
                    user_id: { not: requestingUserId }
                }
            }));
            // Also need to handle notifications/social/payments that might be orphaned if not fully cascading or if we want to be explicit?
            // Prisma cascades should handle relations where `onDelete: Cascade` is set.
            // User -> Payments, Likes, Comments, Wishlists, Notifications all have Cascade.
        }
        // 3. Handle Independent Tables (if not already deleted by UI/User deletion)
        // If we ONLY want to delete Payments but keep Users/UIs:
        if (targets.payments) {
            transactionOperations.push(PrismaInstance_1.default.payment.deleteMany({}));
        }
        if (targets.social) {
            transactionOperations.push(PrismaInstance_1.default.like.deleteMany({}));
            transactionOperations.push(PrismaInstance_1.default.comment.deleteMany({}));
            transactionOperations.push(PrismaInstance_1.default.wishlist.deleteMany({}));
        }
        if (targets.notifications) {
            transactionOperations.push(PrismaInstance_1.default.notification.deleteMany({}));
        }
        // Execute Transaction
        if (transactionOperations.length > 0) {
            yield PrismaInstance_1.default.$transaction(transactionOperations);
        }
        console.log("System Reset Steps Complete.");
        res.json({ status: true, message: "Selected system data has been reset." });
    }
    catch (error) {
        console.error("System Reset Error:", error);
        res.status(500).json({ status: false, message: "Failed to reset system data" });
    }
});
exports.resetData = resetData;
