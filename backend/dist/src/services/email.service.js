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
const dotenv_1 = __importDefault(require("dotenv"));
const nodemailer_1 = __importDefault(require("nodemailer"));
// Load environment variables from .env file
dotenv_1.default.config();
// Email service configuration with type safety
const transporter = nodemailer_1.default.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
function sendOTPEmail(email, otp) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!email || !otp) {
            throw new Error('Email and OTP are required');
        }
        const mailOptions = {
            from: `Monkframe Security <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verification Code - Monkframe',
            html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Monkframe Verification</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        body { 
          margin: 0; 
          padding: 0; 
          background-color: #000000; 
          font-family: 'Inter', Arial, sans-serif;
          color: #ffffff;
        }
        
        .container { 
          max-width: 500px; 
          margin: 0 auto; 
          padding: 60px 20px;
        }
        
        .card {
          background: #050505;
          border: 1px solid #1a1a1a;
          border-radius: 2px;
          overflow: hidden;
          text-align: center;
        }
        
        .header {
          padding: 40px 0 20px 0;
          background: #000000;
          border-bottom: 1px solid #1a1a1a;
        }
        
        .brand-text {
          color: #ffffff;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -1px;
          text-transform: capitalize;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        h2 {
          margin: 0 0 10px 0;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }
        
        p {
          margin: 0 0 30px 0;
          font-size: 14px;
          line-height: 1.6;
          color: #71717a;
        }
        
        .otp-box {
          display: inline-block;
          background: #ffffff;
          color: #000000;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: 6px;
          padding: 16px 40px;
          border-radius: 4px;
          margin-bottom: 30px;
        }
        
        .footer {
          padding: 30px;
          border-top: 1px solid #1a1a1a;
          background: #020202;
          font-size: 11px;
          color: #52525b;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      </style>
    </head>
    <body style="background-color: #000000;">
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="brand-text">Monkframe</div>
          </div>
          
          <div class="content">
            <h2>Authentication Required</h2>
            <p>Please enter the following verification code to access your workspace.</p>
            
            <div class="otp-box">${otp}</div>
            
            <p style="font-size: 12px; margin-bottom: 0;">Code expires in 10 minutes. <br>Ignore if you didn't request this.</p>
          </div>
          
          <div class="footer">
            &copy; ${new Date().getFullYear()} Monkframe Inc.
          </div>
        </div>
      </div>
    </body>
    </html>
    `
        };
        try {
            yield transporter.sendMail(mailOptions);
            return true;
        }
        catch (error) {
            console.error('Error sending OTP email:', error instanceof Error ? error.message : error);
            return false;
        }
    });
}
exports.default = sendOTPEmail;
