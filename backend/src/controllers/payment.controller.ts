import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getIO } from '../config/socket';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    // @ts-ignore
    apiVersion: '2024-12-18.acacia',

});


import PrismaInstance from '../config/PrismaInstance';

export const createPaymentIntent = async (req: Request, res: Response) => {
    try {
        const { amount, currency = 'usd', uiId } = req.body;
        const userId = (req.user as any)?.user_id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!amount || !uiId) {
            res.status(400).json({ error: 'Amount and UI ID are required' });
            return;
        }

        const paymentIntent = await stripe.paymentIntents.create({
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

        const payment = await PrismaInstance.payment.create({
            data: {
                amount: amount / 100, // Store in main currency unit (e.g., dollars), stripe is in cents
                status: 'PENDING',
                userId: parseInt(userId),
                uiId: uiId,
                stripePaymentIntentId: paymentIntent.id
            }
        });

        // Fetch full details for real-time update
        const fullPayment = await PrismaInstance.payment.findUnique({
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
            getIO().emit('payment:new', { payment: formattedPayment });
        }

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error: any) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const confirmPayment = async (req: Request, res: Response) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            res.status(400).json({ error: 'Payment Intent ID is required' });
            return;
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            await PrismaInstance.payment.updateMany({
                where: { stripePaymentIntentId: paymentIntentId },
                data: { status: 'COMPLETED' }
            });

            // Fetch UI details for better message
            const ui = await PrismaInstance.uI.findUnique({
                where: { id: paymentIntent.metadata.uiId },
                select: { title: true }
            });
            const uiTitle = ui?.title || paymentIntent.metadata.uiId;
            const message = `Payment Successful: ${uiTitle}`;

            // Create Notification
            await PrismaInstance.notification.create({
                data: {
                    type: 'PAYMENT',
                    message: message,
                    userId: parseInt(paymentIntent.metadata.userId),
                    uiId: paymentIntent.metadata.uiId,
                    isRead: false
                }
            });

            // Emit real-time update
            getIO().emit('payment:updated', { paymentIntentId, status: 'COMPLETED' });

            // Emit notification event to specific user and admins
            const userId = parseInt(paymentIntent.metadata.userId);

            // Fetch user details for real-time display
            const userDetails = await PrismaInstance.user.findUnique({
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
            getIO().to(userId.toString()).emit('new-notification', notificationPayload);
            // To Admins
            getIO().to('admin').emit('new-notification', notificationPayload);

            // Here you can unlock content, send email, etc.

            res.json({ success: true, status: 'COMPLETED' });
        } else {
            res.status(400).json({ success: false, status: paymentIntent.status });
        }
    } catch (error: any) {
        console.error('Confirm Payment Error:', error);
        res.status(500).json({ error: error.message });
    }
};
