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
exports.processUpload = void 0;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const socket_1 = require("../config/socket");
const uploadFileToDrive = (filePath, fileName, mimeType, isPublic) => __awaiter(void 0, void 0, void 0, function* () {
    // OAuth2 Strategy
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing OAuth Credentials");
    }
    const auth = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground');
    auth.setCredentials({ refresh_token: refreshToken });
    const drive = googleapis_1.google.drive({ version: 'v3', auth });
    const media = {
        mimeType: mimeType,
        body: fs_1.default.createReadStream(filePath),
    };
    const created = yield drive.files.create({
        requestBody: {
            name: fileName,
            mimeType: mimeType,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: media,
        fields: 'id, webContentLink, webViewLink, thumbnailLink',
        supportsAllDrives: true,
    });
    const fileId = created.data.id;
    if (isPublic) {
        yield drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });
    }
    return {
        id: fileId,
        publicUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
        webViewLink: created.data.webViewLink
    };
});
const processUpload = (data) => __awaiter(void 0, void 0, void 0, function* () {
    const { filePath, fileName, mimeType, uiId, type, isPublic, userId } = data;
    console.log(`📤 Processing Upload (Sync): ${type} for UI ${uiId}`);
    try {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`File not found at ${filePath}`);
        }
        const upload = yield uploadFileToDrive(filePath, fileName, mimeType, isPublic);
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
            // MySQL JSON atomic update
            yield PrismaInstance_1.default.$executeRaw `
                UPDATE uis 
                SET showcase = JSON_ARRAY_APPEND(COALESCE(showcase, JSON_ARRAY()), '$', ${upload.publicUrl})
                WHERE id = ${uiId}
            `;
        }
        // Notify User/Frontend
        const io = (0, socket_1.getIO)();
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
    }
    catch (error) {
        console.error(`❌ Upload Failed:`, error);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        const io = (0, socket_1.getIO)();
        if (userId) {
            io.to(userId.toString()).emit('upload:error', {
                uiId,
                type,
                message: error.message
            });
        }
        // Don't throw, just log, so request can finish if using await
    }
});
exports.processUpload = processUpload;
