import express from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateUser } from '../middlewares/auth.middleware';

const router = express.Router();

// Authentication Routes
router.get('/google', userController.googleAuth);
router.get('/google/callback', userController.googleAuthCallback);
router.get('/logout', userController.logout);
router.get('/current_user', userController.getCurrentUser);
router.get('/profile', authenticateUser, userController.getUserProfile);

export default router;
