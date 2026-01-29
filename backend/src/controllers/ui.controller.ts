import { Request, Response } from 'express';
import PrismaInstance from '../config/PrismaInstance';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getIO } from '../config/socket';
import { uploadQueue } from '../config/queue';
import { uploadFileToDrive, deleteFileFromDrive } from '../services/drive.service';
import { transformToProxy } from '../utils/helpers';


// Helper removed (Moved to Worker)

// Fetch all UIs
export const getUIs = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.user_id;
        const { creatorId, category, sort } = req.query;

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 12; // Default 12 for grid layout
        const skip = (page - 1) * limit;

        const where: any = {};
        if (creatorId) {
            where.creatorId = parseInt(creatorId as string);
        }
        if (category && category !== 'All') {
            where.category = category as string;
        }

        const search = req.query.search as string;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { overview: { contains: search, mode: 'insensitive' } },
                { author: { contains: search, mode: 'insensitive' } }
            ];
        }

        let orderBy: any = { created_at: 'desc' };
        if (sort === 'trending') {
            orderBy = { likes: 'desc' };
        } else if (sort === 'newest') {
            orderBy = { created_at: 'desc' };
        }

        // Run count and findMany in parallel
        const [total, uis] = await Promise.all([
            PrismaInstance.uI.count({ where }),
            PrismaInstance.uI.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    creator: { select: { full_name: true, user_id: true } },
                    _count: { select: { comments: true } },
                    // If user is logged in, check if they liked/wished
                    ...(userId && {
                        userLikes: { where: { user_id: userId } },
                        wishedBy: { where: { user_id: userId } }
                    })
                }
            })
        ]);

        const data = uis.map((ui: any) => ({
            ...ui,
            imageSrc: transformToProxy(ui.imageSrc, req),
            showcase: (ui.showcase && Array.isArray(ui.showcase)) ? (ui.showcase as string[]).map(url => transformToProxy(url, req)) : [],
            liked: userId ? (ui.userLikes && ui.userLikes.length > 0) : false,
            wished: userId ? (ui.wishedBy && ui.wishedBy.length > 0) : false,
            commentsCount: ui._count?.comments || 0,
            // Remove the relation arrays from response to keep it clean
            userLikes: undefined,
            wishedBy: undefined,
            _count: undefined
        }));

        res.json({
            status: true,
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching UIs:", error);
        res.status(500).json({ status: false, message: "Failed to fetch UIs" });
    }
};

// Get Single UI
export const getUI = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.user_id;

        const ui = await PrismaInstance.uI.findUnique({
            where: { id },
            include: {
                creator: { select: { full_name: true, user_id: true } },
                _count: { select: { comments: true } },
                ...(userId && {
                    userLikes: { where: { user_id: userId } },
                    wishedBy: { where: { user_id: userId } }
                })
            }
        });

        if (!ui) {
            return res.status(404).json({ status: false, message: "UI not found" });
        }

        // Fetch File Size from Drive if exists
        let fileSize = "Unknown";
        if (ui.google_file_id) {
            try {
                const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
                const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

                if (clientId && clientSecret && refreshToken) {
                    const auth = new google.auth.OAuth2(
                        clientId,
                        clientSecret,
                        'https://developers.google.com/oauthplayground'
                    );
                    auth.setCredentials({ refresh_token: refreshToken });
                    const drive = google.drive({ version: 'v3', auth });

                    const fileMeta = await drive.files.get({
                        fileId: ui.google_file_id,
                        fields: 'size'
                    });

                    if (fileMeta.data.size) {
                        const bytes = parseInt(fileMeta.data.size);
                        if (bytes < 1024 * 1024) {
                            fileSize = (bytes / 1024).toFixed(1) + " KB";
                        } else {
                            fileSize = (bytes / (1024 * 1024)).toFixed(1) + " MB";
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch Drive file size:", err);
            }
        }

        const data = {
            ...ui,
            imageSrc: transformToProxy(ui.imageSrc, req),
            showcase: (ui.showcase && Array.isArray(ui.showcase)) ? (ui.showcase as string[]).map(url => transformToProxy(url, req)) : [],
            fileSize, // Add file size to response
            liked: userId ? (ui.userLikes && (ui.userLikes as any[]).length > 0) : false,
            wished: userId ? (ui.wishedBy && (ui.wishedBy as any[]).length > 0) : false,
            commentsCount: ui._count?.comments || 0,
            userLikes: undefined,
            wishedBy: undefined,
            _count: undefined
        };

        res.json({ status: true, data });
    } catch (error) {
        console.error("Error fetching UI:", error);
        res.status(500).json({ status: false, message: "Failed to fetch UI" });
    }
};

// Download UI
export const downloadUI = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ui = await PrismaInstance.uI.findUnique({ where: { id } });

        if (!ui || !ui.google_file_id) {
            return res.status(404).json({ status: false, message: "File not found" });
        }

        // OAuth2 Strategy
        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error("Missing OAuth Credentials");
        }

        const auth = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'https://developers.google.com/oauthplayground'
        );
        auth.setCredentials({ refresh_token: refreshToken });

        const drive = google.drive({ version: 'v3', auth });

        const fileStream = await drive.files.get(
            { fileId: ui.google_file_id, alt: 'media' },
            { responseType: 'stream' }
        );

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${ui.title || 'download'}.zip"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // Increment Download Counter
        await PrismaInstance.uI.update({
            where: { id },
            data: { downloads: { increment: 1 } }
        });

        fileStream.data.pipe(res);

    } catch (error) {
        console.error("Download Error:", error);
        res.status(500).json({ status: false, message: "Download failed or credentials missing" });
    }
};

// Create new UI
export const createUI = async (req: Request, res: Response) => {
    try {
        const { title, price, category, author, color, overview, highlights, rating } = req.body;
        const userId = (req.user as any)?.user_id;

        // Handle Files
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

        // Prepare Upload Promises
        let bannerUpload: Promise<any> | null = null;
        let uiFileUpload: Promise<any> | null = null;
        const showcaseUploads: Promise<any>[] = [];

        // 1. Banner
        if (files && files['banner'] && files['banner'][0]) {
            const file = files['banner'][0];
            bannerUpload = uploadFileToDrive(file.path, file.originalname, file.mimetype, true);
        }

        // 2. UI File
        if (files && files['uiFile'] && files['uiFile'][0]) {
            const file = files['uiFile'][0];
            uiFileUpload = uploadFileToDrive(file.path, file.originalname, file.mimetype, false);
        }

        // 3. Showcase Images
        if (files && files['showcase']) {
            for (const file of files['showcase']) {
                showcaseUploads.push(uploadFileToDrive(file.path, file.originalname, file.mimetype, true));
            }
        }

        // Wait for all uploads
        const [bannerResult, uiFileResult, ...showcaseResults] = await Promise.all([
            bannerUpload,
            uiFileUpload,
            ...showcaseUploads
        ]);

        // Clean up local files
        if (files) {
            Object.values(files).flat().forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }

        // Parse highlights
        let parsedHighlights: string[] = [];
        if (highlights) {
            try {
                parsedHighlights = typeof highlights === 'string' ? JSON.parse(highlights) : highlights;
            } catch (e) {
                parsedHighlights = [highlights];
            }
        }

        // Parse specifications
        let parsedSpecifications: any[] = [];
        const { specifications } = req.body;
        if (specifications) {
            try {
                parsedSpecifications = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
            } catch (e) {
                console.error("Failed to parse specifications", e);
                parsedSpecifications = []; // Fallback
            }
        }

        // Create UI Record with actual URLs
        const newUI = await PrismaInstance.uI.create({
            data: {
                title,
                price: price.toString(),
                category,
                imageSrc: bannerResult ? bannerResult.publicUrl : null, // Use actual URL
                author,
                google_file_id: uiFileResult ? uiFileResult.id : null, // Use actual ID
                color,
                overview,
                highlights: parsedHighlights,
                specifications: parsedSpecifications,
                rating: rating ? parseFloat(rating) : 4.8,
                showcase: showcaseResults.map(res => res.publicUrl), // Use actual URLs
                fileType: (files && files['uiFile'] && files['uiFile'][0]) ? files['uiFile'][0].originalname.split('.').pop()?.toUpperCase() : null
            }
        });

        // Emit initial socket event
        const ioData = {
            ...newUI,
            imageSrc: transformToProxy(newUI.imageSrc, req),
            showcase: (newUI.showcase && Array.isArray(newUI.showcase)) ? (newUI.showcase as string[]).map(url => transformToProxy(url, req)) : []
        };
        getIO().emit('ui:new', { ui: ioData });

        res.status(201).json({
            status: true,
            message: "UI Created and files uploaded.",
            data: ioData
        });

    } catch (error) {
        console.error("Create UI Error:", error);
        // Clean up uploaded files if DB creation fails?
        // Ideally yes, but skipping for now as per "best effort"
        res.status(500).json({ status: false, message: "Failed to create UI" });
    }
};


// Update UI
export const updateUI = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, price, category, author, overview, highlights, rating } = req.body;

        // Fetch existing UI
        const existingUI = await PrismaInstance.uI.findUnique({ where: { id } });
        if (!existingUI) {
            return res.status(404).json({ status: false, message: "UI not found" });
        }

        // Handle Files
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const userId = (req.user as any)?.user_id;

        // Queue Updatable Files

        // 1. Banner
        if (files && files['banner'] && files['banner'][0]) {
            const file = files['banner'][0];
            uploadQueue.add({
                filePath: file.path,
                fileName: file.originalname,
                mimeType: file.mimetype,
                uiId: id,
                type: 'BANNER',
                isPublic: true,
                userId
            });
            // Note: We don't delete the old file here, we let the worker replace the URL. 
            // Cleanup of old files on Drive is tricky asynchronously unless we track file IDs. 
            // For now, we focus on uploading the new one.
        }

        // 2. UI File
        if (files && files['uiFile'] && files['uiFile'][0]) {
            const file = files['uiFile'][0];
            uploadQueue.add({
                filePath: file.path,
                fileName: file.originalname,
                mimeType: file.mimetype,
                uiId: id,
                type: 'UI_FILE',
                isPublic: false,
                userId
            });
        }

        // 3. Showcase
        if (files && files['showcase']) {
            for (const file of files['showcase']) {
                uploadQueue.add({
                    filePath: file.path,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    uiId: id,
                    type: 'SHOWCASE',
                    isPublic: true,
                    userId
                });
            }
        }

        // Parse highlights
        let parsedHighlights: string[] | undefined = undefined;
        if (highlights) {
            try {
                parsedHighlights = typeof highlights === 'string' ? JSON.parse(highlights) : highlights;
            } catch (e) {
                parsedHighlights = [highlights];
            }
        }

        // Parse specifications
        let parsedSpecifications: any[] | undefined = undefined;
        const { specifications } = req.body;
        if (specifications) {
            try {
                parsedSpecifications = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
            } catch (e) {
                console.error("Failed to parse specifications update", e);
            }
        }

        // Update Text Fields Immediately
        const updatedUI = await PrismaInstance.uI.update({
            where: { id },
            data: {
                title,
                price,
                category,
                // Don't update imageSrc/google_file_id here, worker does it
                author,
                overview,
                // Showcase appends in worker usually, checking if we need to clear it first?
                // The previous logic REPLACED showcase if new ones came. 
                // "If files[showcase] -> Replace".
                // Async replace is hard. The worker currently AP PENDS. 
                // Let's stick to APPEND for now or we need a specific "CLEAR SHOWCASE" flag/job.
                rating: rating ? parseFloat(rating) : undefined,
                highlights: parsedHighlights,
                specifications: parsedSpecifications,
                ...(files && files['uiFile'] && files['uiFile'][0] ? {
                    fileType: files['uiFile'][0].originalname.split('.').pop()?.toUpperCase()
                } : {})
            }
        });

        // Emit real-time update
        const ioData = {
            ...updatedUI,
            imageSrc: transformToProxy(updatedUI.imageSrc, req),
            showcase: (updatedUI.showcase && Array.isArray(updatedUI.showcase)) ? (updatedUI.showcase as string[]).map(url => transformToProxy(url, req)) : []
        };
        getIO().emit('ui:updated', { ui: ioData });

        res.json({
            status: true,
            message: "UI Updated. Files are processing in background.",
            data: ioData
        });

    } catch (error) {
        console.error("Update UI Error:", error);
        res.status(500).json({ status: false, message: "Failed to update UI" });
    }
};

// deleteFileFromDrive removed (imported from service)

// ... existing code ...

const extractDriveFileId = (url: string): string | null => {
    if (!url) return null;

    // Pattern 1: id=FILE_ID (e.g. uc?id=... or open?id=...)
    const idMatch = url.match(/[?&]id=([^&]+)/i);
    if (idMatch && idMatch[1]) return idMatch[1];

    // Pattern 2: /d/FILE_ID (e.g. file/d/.../view)
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch && dMatch[1]) return dMatch[1];

    return null;
};

// ... existing code ...

// Delete UI
export const deleteUI = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 1. Find the UI to get file IDs
        const ui = await PrismaInstance.uI.findUnique({ where: { id } });

        if (!ui) {
            return res.status(404).json({ status: false, message: "UI not found" });
        }

        // 2. Delete UI File (if exists)
        if (ui.google_file_id) {
            await deleteFileFromDrive(ui.google_file_id);
        }

        // 3. Delete Banner Image (if exists)
        if (ui.imageSrc) {
            const fileId = extractDriveFileId(ui.imageSrc);
            if (fileId) {
                console.log(`Deleting Banner from Drive: ${fileId}`);
                await deleteFileFromDrive(fileId);
            }
        }

        // 4. Delete Showcase Images
        const showcase = ui.showcase as string[];
        if (showcase && showcase.length > 0) {
            for (const url of showcase) {
                const fileId = extractDriveFileId(url);
                if (fileId) {
                    console.log(`Deleting Showcase Image from Drive: ${fileId}`);
                    await deleteFileFromDrive(fileId);
                }
            }
        }

        // 5. Delete from DB
        await PrismaInstance.uI.delete({ where: { id } });

        // Emit real-time event
        getIO().emit('ui:deleted', { id });

        res.json({ status: true, message: "UI and associated Drive files deleted successfully" });
    } catch (error) {
        console.error("Delete UI Error:", error);
        res.status(500).json({ status: false, message: "Failed to delete UI" });
    }
};

// Stream Image Proxy with Caching
export const streamImage = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const CACHE_DIR = path.join(__dirname, '../../cache');
        const CACHE_FILE = path.join(CACHE_DIR, `${fileId}`);

        // Ensure cache directory exists
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }

        // 1. Browser Caching Headers (Client-side)
        // Cache for 1 year (immutable) since fileIds are unique
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        // 2. Server-Side Caching (Disk Cache)
        if (fs.existsSync(CACHE_FILE)) {
            // Serve from Disk Cache
            const fileStream = fs.createReadStream(CACHE_FILE);
            fileStream.pipe(res);
            return;
        }

        // If not in cache, fetch from Drive
        // OAuth2 Strategy
        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error("Missing OAuth Credentials");
        }

        const auth = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'https://developers.google.com/oauthplayground'
        );
        auth.setCredentials({ refresh_token: refreshToken });

        const drive = google.drive({ version: 'v3', auth });

        // Fetch stream
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        // Pipe to Response AND Save to Disk Cache
        const dest = fs.createWriteStream(CACHE_FILE);

        response.data.pipe(dest); // Save to cache
        response.data.pipe(res);  // Send to client

        // Handle errors during streaming
        response.data.on('error', (err) => {
            console.error('Error streaming data:', err);
            // Try to clean up partial file
            if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
        });

    } catch (error) {
        console.error("Image Stream Error:", error);
        res.status(404).send("Image not found");
    }
};
