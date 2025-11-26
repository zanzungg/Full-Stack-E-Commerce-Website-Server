import UserModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendVerificationEmail from "../config/sendVerificationEmail.js";
import VerificationEmailTemplate from "../utils/verifyEmailTemplate.js";

export async function registerUserController(req, res) {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Name, email and password are required',
                error: true,
                success: false
            });
        }
        const userExists = await UserModel.findOne({ email });
        if (userExists) {
            return res.status(409).json({
                message: 'User already exists with this email',
                error: true,
                success: false
            });
        }

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new UserModel({
            name,
            email,
            password: hashedPassword,
            otp: verifyCode,
            otp_expiry: Date.now() + 10 * 60 * 1000 // 10 minutes from now
        });

        await newUser.save();

        // Send verification email logic here (omitted for brevity)
        await sendVerificationEmail({
            sendTo: email,
            subject: 'Verify your email from E-Commerce App',
            text: 'Please verify your email using the OTP sent to your email address.',
            html: VerificationEmailTemplate(name, verifyCode)
        });

        // Create a JWT token for verification purpose (if needed)
        const token = jwt.sign(
            { email: newUser.email, id: newUser._id },
            process.env.JWT_SECRET,
        );

        return res.status(200).json({
            message: 'User registered successfully! Please verify your email.',
            error: false,
            success: true,
            token: token, // Optional: return token for further use
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

export async function verifyEmailController(req, res) {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                message: 'Email and OTP are required',
                error: true,
                success: false
            });
        }

        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        const isCodeValid = user.otp === otp;
        const isNotExpired = user.otp_expiry > Date.now();

        if (!isCodeValid || !isNotExpired) {
            return res.status(400).json({
                message: 'Invalid or expired OTP',
                error: true,
                success: false
            });
        }

        user.verify_email = true;
        user.otp = null;
        user.otp_expiry = null;
        await user.save();

        return res.status(200).json({
            message: 'Email verified successfully',
            error: false,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
}