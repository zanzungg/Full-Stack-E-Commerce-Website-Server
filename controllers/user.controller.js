import UserModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendVerificationEmail from "../config/sendVerificationEmail.js";
import VerificationEmailTemplate from "../utils/verifyEmailTemplate.js";
import generateAccessToken from "../utils/generatedAccessToken.js";
import generateRefreshToken from "../utils/generatedRefreshToken.js";
import { uploadAvatar, deleteImage } from "../utils/cloudinary.js";

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Register User Controller
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

        try {
            await sendVerificationEmail({
                sendTo: email,
                subject: 'Verify your email from E-Commerce App',
                text: 'Please verify your email using the OTP sent to your email address.',
                html: VerificationEmailTemplate(name, verifyCode)
            });
        } catch (emailError) {
            // Email failed but user created - log error
            console.error('Failed to send verification email:', emailError);
            // Consider: delete user or allow retry
        }

        // Create a JWT token for verification purpose (if needed)
        const token = jwt.sign(
            { email: newUser.email, id: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // expiry time
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

// Verify Email Controller
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

// Login User Controller
export async function loginUserController(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required',
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

        if (user.status !== 'Active') {
            return res.status(403).json({
                message: 'User account is not active',
                error: true,
                success: false
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid password',
                error: true,
                success: false
            });
        }

        const accessToken = await generateAccessToken(user);
        const refreshToken = await generateRefreshToken(user);

        await UserModel.findByIdAndUpdate(
            user._id,
            { last_login_date: Date.now() },
        );

        const cookiesOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
        };

        res.cookie('accessToken', accessToken, cookiesOptions);
        res.cookie('refreshToken', refreshToken, cookiesOptions);

        return res.status(200).json({
            message: 'Login successful',
            error: false,
            success: true,
            data: {
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
}

// Logout User Controller
export async function logoutUserController(req, res) {
    try {
        const userId = req.userId; // Từ auth middleware
        
        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized',
                error: true,
                success: false
            });
        }

        const cookiesOption = {
            httpOnly: true,
            secure: true,
            sameSite: 'None'
        };

        // Clear cookies trước
        res.clearCookie('accessToken', cookiesOption);
        res.clearCookie('refreshToken', cookiesOption);
        
        await UserModel.findByIdAndUpdate(
            userId,
            { refresh_token: "" }
        );

        return res.status(200).json({
            message: 'Logout successful',
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

// Upload Avatar Controller - Optimized
export async function uploadAvatarController(req, res) {
    try {
        const userId = req.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                message: 'No image file provided',
                error: true,
                success: false
            });
        }

        // Find user
        const user = await UserModel.findById(userId).select('avatar avatar_public_id');
        if (!user) {
            // Cleanup uploaded file
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        // Upload new avatar to Cloudinary
        const { url, publicId } = await uploadAvatar(file.path, userId);

        // Delete old avatar from Cloudinary (after successful upload)
        if (user.avatar_public_id) {
            await deleteImage(user.avatar_public_id);
        }

        // Update user with new avatar
        user.avatar = url;
        user.avatar_public_id = publicId;
        await user.save();

        return res.status(200).json({
            message: 'Avatar uploaded successfully',
            error: false,
            success: true,
            data: {
                avatar: url
            }
        });

    } catch (error) {
        // Cleanup local file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            message: error.message || 'Failed to upload avatar',
            error: true,
            success: false
        });
    }
}
