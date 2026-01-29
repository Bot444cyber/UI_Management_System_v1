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
exports.uploadWorker = void 0;
const fs_1 = __importDefault(require("fs"));
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const socket_1 = require("../config/socket");
const drive_service_1 = require("../services/drive.service");
// uploadFileToDrive removed (imported from service)
const uploadWorker = (job) => __awaiter(void 0, void 0, void 0, function* () {
    const { filePath, fileName, mimeType, uiId, type, isPublic, userId } = job.data;
    console.log(`📤 Processing Upload Job: ${type} for UI ${uiId}`);
    try {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`File not found at ${filePath}`);
        }
        const upload = yield (0, drive_service_1.uploadFileToDrive)(filePath, fileName, mimeType, isPublic);
        // Update Database
        if (type === 'BANNER') {
            yield PrismaInstance_1.default.uI.update({
                where: { id: uiId },
                data: { imageSrc: upload.publicUrl }
            });
        }
        else if (type === 'UI_FILE') {
            yield PrismaInstance_1.default.uI.update({
                where: { id: uiId },
                data: { google_file_id: upload.id }
            });
        }
        else if (type === 'SHOWCASE') {
            // Need to append to existing showcase array
            // Since Prisma push for arrays is simple, we fetch first? 
            // Or just use push if supported. Postgres supports it.
            // Prisma supports push on string arrays
            yield PrismaInstance_1.default.uI.update({
                where: { id: uiId },
                data: { showcase: { push: upload.publicUrl } }
            });
        }
        // Notify User/Frontend
        const io = (0, socket_1.getIO)();
        // Emit general update
        if (userId) {
            io.to(userId.toString()).emit('upload:complete', {
                uiId,
                type,
                status: 'success',
                url: upload.publicUrl
            });
        }
        // Clean up
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        return Promise.resolve();
    }
    catch (error) {
        console.error(`❌ Upload Job Failed:`, error);
        // Clean up even on fail if file exists
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        // Notify Error
        const io = (0, socket_1.getIO)();
        if (userId) {
            io.to(userId.toString()).emit('upload:error', {
                uiId,
                type,
                message: error.message
            });
        }
        throw error;
    }
});
exports.uploadWorker = uploadWorker;
