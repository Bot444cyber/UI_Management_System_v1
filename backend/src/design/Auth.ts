import bcrypt from "bcrypt";
import OTP from "./Otp";
import GenerateToken from "../config/module/generator/GenerateToken";
import PrismaInstance from "../config/PrismaInstance";

// Interface
interface IToken {
    full_name: string;
    role: string;
    user_id: number;
    email: string;
}

interface AuthResponse {
    status: boolean;
    message: string;
    token?: string;
    requireOtp?: boolean;
}

class Auth {
    public static instance = new Auth();

    constructor() {
        // Default Constructor
    }

    public async login(email: string, password: string): Promise<AuthResponse> {
        try {
            if (!email || !password) {
                return { status: false, message: "Email and password are required" };
            }

            const user = await PrismaInstance.user.findUnique({
                where: { email }
            });

            if (!user) {
                return { status: false, message: "User not found" };
            }

            // Verify HashedPassword
            if (!user.password_hash) {
                return { status: false, message: "Invalid credentials" };
            }

            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return { status: false, message: "Invalid password" };
            }

            // Get User Data
            const tokenData: IToken = {
                full_name: user.full_name || '',
                role: user.role,
                user_id: user.user_id,
                email: user.email
            };

            // Return Token
            return { status: true, message: "Login successful", token: GenerateToken(tokenData) };
        }
        catch (error) {
            console.error(`Login failed: ${error}`);
            return { status: false, message: "Internal server error" };
        }
    }

    public async verifyOtp(email: string, otp: number): Promise<AuthResponse> {
        try {
            const isValid = await OTP.isValidOTP(email, otp);
            if (!isValid) {
                return { status: false, message: "Invalid or expired OTP" };
            }

            const user = await PrismaInstance.user.findUnique({
                where: { email }
            });

            if (!user) {
                return { status: false, message: "User not found" };
            }

            // Get User Data
            const tokenData: IToken = {
                full_name: user.full_name || '',
                role: user.role,
                user_id: user.user_id,
                email: user.email
            };

            // Return Token
            return { status: true, message: "Login successful", token: GenerateToken(tokenData) };
        } catch (error) {
            console.error(`OTP verification failed: ${error}`);
            return { status: false, message: "Internal server error" };
        }
    }

    public async register(email: string, password: string, fullName: string, otp: number): Promise<AuthResponse> {
        try {
            // Verify OTP first
            const isValid = await OTP.isValidOTP(email, otp);
            if (!isValid) {
                return { status: false, message: "Invalid or expired OTP" };
            }

            // Check if user already exists (double check)
            const existingUser = await PrismaInstance.user.findUnique({
                where: { email }
            });

            if (existingUser) {
                return { status: false, message: "User already exists" };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create User
            const newUser = await PrismaInstance.user.create({
                data: {
                    email,
                    password_hash: passwordHash,
                    full_name: fullName,
                    role: 'CUSTOMER' // Default role
                }
            });

            if (!newUser) {
                return { status: false, message: "Failed to create user" };
            }

            // Get User Data
            const tokenData: IToken = {
                full_name: newUser.full_name || '',
                role: newUser.role,
                user_id: newUser.user_id,
                email: newUser.email
            };

            // Return Token
            return { status: true, message: "Registration successful", token: GenerateToken(tokenData) };

        } catch (error) {
            console.error(`Registration failed: ${error}`);
            return { status: false, message: "Internal server error" };
        }
    }
}

export { Auth, IToken };
