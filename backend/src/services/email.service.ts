import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { SentMessageInfo } from 'nodemailer/lib/smtp-transport';

// Load environment variables from .env file
dotenv.config();

// Define interface for email configuration
interface EmailConfig {
  service: string;
  auth: {
    user: string | undefined;
    pass: string | undefined;
  };
}

// Email service configuration with type safety
const transporter: Transporter<SentMessageInfo> = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
} as EmailConfig);

// Define interface for email options
interface MailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
}

async function sendOTPEmail(email: string, otp: any): Promise<boolean> {
  if (!email || !otp) {
    throw new Error('Email and OTP are required');
  }

  const mailOptions: MailOptions = {
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
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error: unknown) {
    console.error('Error sending OTP email:', error instanceof Error ? error.message : error);
    return false;
  }
}

export default sendOTPEmail;