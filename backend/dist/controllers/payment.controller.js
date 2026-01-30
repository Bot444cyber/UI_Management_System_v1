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
exports.confirmPayment = exports.createPaymentIntent = void 0;
const stripe_1 = __importDefault(require("stripe"));
const socket_1 = require("../config/socket");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    // @ts-ignore
    apiVersion: '2024-12-18.acacia',
});
const PrismaInstance_1 = __importDefault(require("../config/PrismaInstance"));
const createPaymentIntent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { amount, currency = 'usd', uiId } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.user_id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (!amount || !uiId) {
            res.status(400).json({ error: 'Amount and UI ID are required' });
            return;
        }
        const paymentIntent = yield stripe.paymentIntents.create({
            amount,
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: userId.toString(),
                uiId: uiId.toString()
            }
        });
        const payment = yield PrismaInstance_1.default.payment.create({
            data: {
                amount: amount / 100, // Store in main currency unit (e.g., dollars), stripe is in cents
                status: 'PENDING',
                userId: parseInt(userId),
                uiId: uiId,
                stripePaymentIntentId: paymentIntent.id
            }
        });
        // Fetch full details for real-time update
        const fullPayment = yield PrismaInstance_1.default.payment.findUnique({
            where: { id: payment.id },
            include: {
                user: { select: { full_name: true, email: true } },
                ui: { select: { title: true } }
            }
        });
        if (fullPayment) {
            const formattedPayment = {
                id: fullPayment.id,
                customerName: fullPayment.user.full_name,
                email: fullPayment.user.email,
                item: fullPayment.ui.title,
                date: fullPayment.created_at.toISOString().split('T')[0],
                amount: `$${fullPayment.amount}`,
                status: fullPayment.status.toLowerCase(),
                stripePaymentIntentId: fullPayment.stripePaymentIntentId
            };
            // Emit real-time event
            (0, socket_1.getIO)().emit('payment:new', { payment: formattedPayment });
        }
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    }
    catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createPaymentIntent = createPaymentIntent;
const confirmPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { paymentIntentId } = req.body;
        if (!paymentIntentId) {
            res.status(400).json({ error: 'Payment Intent ID is required' });
            return;
        }
        const paymentIntent = yield stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === 'succeeded') {
            yield PrismaInstance_1.default.payment.updateMany({
                where: { stripePaymentIntentId: paymentIntentId },
                data: { status: 'COMPLETED' }
            });
            // Fetch UI details for better message
            const ui = yield PrismaInstance_1.default.uI.findUnique({
                where: { id: paymentIntent.metadata.uiId },
                select: { title: true }
            });
            const uiTitle = (ui === null || ui === void 0 ? void 0 : ui.title) || paymentIntent.metadata.uiId;
            const message = `Payment Successful: ${uiTitle}`;
            // Create Notification
            yield PrismaInstance_1.default.notification.create({
                data: {
                    type: 'PAYMENT',
                    message: message,
                    userId: parseInt(paymentIntent.metadata.userId),
                    uiId: paymentIntent.metadata.uiId,
                    isRead: false
                }
            });
            // Emit real-time update
            (0, socket_1.getIO)().emit('payment:updated', { paymentIntentId, status: 'COMPLETED' });
            // Emit notification event to specific user and admins
            const userId = parseInt(paymentIntent.metadata.userId);
            // Fetch user details for real-time display
            const userDetails = yield PrismaInstance_1.default.user.findUnique({
                where: { user_id: userId },
                select: { full_name: true, email: true }
            });
            const notificationPayload = {
                type: 'PAYMENT',
                message: message,
                userId: userId,
                uiId: paymentIntent.metadata.uiId,
                user: userDetails, // Include user details
                ui: { title: uiTitle } // Include UI details
            };
            // To User
            (0, socket_1.getIO)().to(userId.toString()).emit('new-notification', notificationPayload);
            // To Admins
            (0, socket_1.getIO)().to('admin').emit('new-notification', notificationPayload);
            // Here you can unlock content, send email, etc.
            res.json({ success: true, status: 'COMPLETED' });
        }
        else {
            res.status(400).json({ success: false, status: paymentIntent.status });
        }
    }
    catch (error) {
        console.error('Confirm Payment Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.confirmPayment = confirmPayment;
