
import sendOTPEmail from '../services/email.service';
import { processUpload } from '../services/upload.service';

// Mock Queue Implementation for Shared Hosting
// Executes jobs IMMEDIATELY (synchronously or awaited) instead of adding to Redis

interface QueueMock {
    add: (data: any, options?: any) => Promise<void>;
    process: (...args: any[]) => void;
}

export const emailQueue: QueueMock = {
    add: async (jobData: any) => {
        console.log("Mock Queue: Processing Email immediately...");
        const { type, email, data } = jobData;
        try {
            if (type === 'OTP') {
                await sendOTPEmail(email, data.otp);
            }
        } catch (error) {
            console.error("Mock Queue Email Error:", error);
        }
    },
    process: (...args: any[]) => { } // No-op, accepts args to satisfy TS
};

export const uploadQueue: QueueMock = {
    add: async (jobData: any) => {
        console.log("Mock Queue: Processing Upload immediately...");
        await processUpload(jobData);
    },
    process: (...args: any[]) => { } // No-op
};
