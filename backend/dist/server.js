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
exports.sessionMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const PrismaInstance_1 = __importDefault(require("./config/PrismaInstance"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const DataBase_1 = __importDefault(require("./design/DataBase"));
const socket_1 = require("./config/socket");
const express_session_1 = __importDefault(require("express-session"));
require("./config/module/passport");
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const passport_1 = __importDefault(require("passport"));
const error_middleware_1 = require("./middlewares/error.middleware");
const otp_routes_1 = __importDefault(require("./routes/otp.routes"));
const ui_routes_1 = __importDefault(require("./routes/ui.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const interaction_routes_1 = __importDefault(require("./routes/interaction.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 8000;
// ============================================
// DATABASE 
// ============================================
let databaseReady = false;
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🔍 Checking database status...');
            const database = DataBase_1.default.getInstance();
            // Initialize database (check existence, create if needed, connect)
            const initialized = yield database.initializeDatabase();
            yield PrismaInstance_1.default.$connect();
            console.log('✅ Prisma connected successfully');
            // Redis Session removed for Shared Hosting
            // await sessionClient.connect(); 
            if (initialized) {
                databaseReady = true;
                console.log('✅ Database is ready for use');
                // Get connection status for logging
                const status = database.getConnectionStatus();
                console.log(`📊 Database Status: Connected=${status.isConnected}, Created=${status.isDatabaseCreated}`);
            }
            else {
                console.warn('⚠️ Database initialization failed - API will use fallback storage');
                databaseReady = false;
            }
        }
        catch (error) {
            console.error('❌ Database initialization error:', error);
            databaseReady = false;
        }
    });
}
// Initialize database on startup
initializeDatabase();
// Background Workers removed for Shared Hosting (using direct services)
// initWorkers();
// ============================================
// MIDDLEWARE
// ============================================
// CORS - Allow all origins in development
const allowedOrigins = [
    process.env.FRONTEND_URL,
].filter((origin) => !!origin);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        // In production, check against allowed origins
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
}));
// Body parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Session configuration
// MemoryStore is used by default if 'store' is not defined.
// NOTE: MemoryStore is not designed for production (leaks memory), 
// but is the only "zero-dependency" option for shared hosting without Redis.
exports.sessionMiddleware = (0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'fallback-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
});
app.use(exports.sessionMiddleware);
// Passport middleware
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Handle preflight requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});
// Add CORS headers to all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    next();
});
// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});
// Initialize Socket.io (Must be after session middleware)
(0, socket_1.initSocket)(httpServer, exports.sessionMiddleware);
// ============================================
// ROUTES
// ============================================
// Use Routes
app.use('/api/auth', user_routes_1.default);
app.use('/api', otp_routes_1.default);
app.use('/api/uis', ui_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/interactions', interaction_routes_1.default);
app.use('/api/payment', payment_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
// Test Route for WebSockets
app.get('/api/test-socket', (req, res) => {
    try {
        const io = (0, socket_1.getIO)();
        io.emit("test-event", { message: "Hello from Backend! WebSockets are working! 🚀" });
        res.json({ success: true, message: "Test event emitted to all clients" });
    }
    catch (error) {
        console.error("Socket error:", error);
        res.status(500).json({ success: false, error: "Failed to emit event" });
    }
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
    });
});
// ============================================
// ERROR HANDLER
// ============================================
app.use(error_middleware_1.errorHandler);
// ============================================
// START SERVER
// ============================================
// ============================================
httpServer.listen(PORT, () => {
    console.log('🚀 ============================================');
    console.log(`🚀 UI Management System `);
    console.log(`🚀 ============================================`);
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`🚀 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`🚀 Health Check: http://localhost:${PORT}/api/health`);
    console.log('🚀 ============================================');
    console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 API Key configured: ${!!process.env.GEMINI_API_KEY}`);
    console.log('🚀 ============================================');
});
exports.default = app;
