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
exports.uploadQueue = exports.emailQueue = void 0;
const email_service_1 = __importDefault(require("../services/email.service"));
const upload_service_1 = require("../services/upload.service");
exports.emailQueue = {
    add: (jobData) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Mock Queue: Processing Email immediately...");
        const { type, email, data } = jobData;
        try {
            if (type === 'OTP') {
                yield (0, email_service_1.default)(email, data.otp);
            }
        }
        catch (error) {
            console.error("Mock Queue Email Error:", error);
        }
    }),
    process: (...args) => { } // No-op, accepts args to satisfy TS
};
exports.uploadQueue = {
    add: (jobData) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Mock Queue: Processing Upload immediately...");
        yield (0, upload_service_1.processUpload)(jobData);
    }),
    process: (...args) => { } // No-op
};
