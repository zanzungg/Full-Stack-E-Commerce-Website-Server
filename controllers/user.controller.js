import UserModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendVerificationEmail from "../config/sendVerificationEmail.js";
import VerificationEmailTemplate from "../utils/verifyEmailTemplate.js";
import generateAccessToken from "../utils/generatedAccessToken.js";
import generateRefreshToken from "../utils/generatedRefreshToken.js";
import { uploadAvatar, deleteImage } from "../utils/cloudinary.js";
import ForgotPasswordTemplate from "../utils/forgotPasswordTemplate.js";

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

        if (!user.verify_email) {
            return res.status(403).json({
                message: 'Email is not verified',
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

// Get User Profile Controller
export async function getUserProfileController(req, res) {
    try {
        const userId = req.userId; // From auth middleware

        const user = await UserModel.findById(userId).select('-password -otp -otp_expiry -refresh_token');
        
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        return res.status(200).json({
            message: 'User profile retrieved successfully',
            error: false,
            success: true,
            data: user
        });
        
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
}

// Update User Profile Controller
export async function updateUserProfileController(req, res) {
    try {
        const userId = req.userId; // From auth middleware
        const { name, email, mobile, password } = req.body;

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        // Check if email is being changed and if new email already exists
        if (email && email !== user.email) {
            const emailExists = await UserModel.findOne({ email });
            if (emailExists) {
                return res.status(409).json({
                    message: 'Email already exists',
                    error: true,
                    success: false
                });
            }
        }

        let verifyCode = "";
        const emailChanged = email && email !== user.email;
        
        if (emailChanged) {
            verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        }

        let hashedPassword = user.password; // Keep existing password by default
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        const updateData = {
            name: name || user.name,
            email: email || user.email,
            mobile: mobile !== undefined ? mobile : user.mobile,
            password: hashedPassword
        };

        // Only update email verification fields if email changed
        if (emailChanged) {
            updateData.verify_email = false;
            updateData.otp = verifyCode;
            updateData.otp_expiry = Date.now() + 10 * 60 * 1000;
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        ).select('-password -otp -otp_expiry -refresh_token');

        // Send verification email if email changed
        if (emailChanged) {
            try {
                await sendVerificationEmail({
                    sendTo: updatedUser.email,
                    subject: 'Verify your updated email from E-Commerce App',
                    text: 'Please verify your email using the OTP sent to your email address.',
                    html: VerificationEmailTemplate(updatedUser.name, verifyCode)
                });
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                // Return success but with warning about email
                return res.status(200).json({
                    message: 'Profile updated but verification email failed to send',
                    error: false,
                    success: true,
                    data: updatedUser,
                    warning: 'Please request a new verification code'
                });
            }
        }

        return res.status(200).json({
            message: emailChanged 
                ? 'Profile updated successfully. Please verify your new email.' 
                : 'Profile updated successfully',
            error: false,
            success: true,
            data: updatedUser
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
}

// Forgot Password Controller
export async function forgotPasswordController(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: 'Email is required',
                error: true,
                success: false
            });
        }

        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(200).json({
                message: 'If your email is registered, you will receive a password reset code',
                error: false,
                success: true
            });
        }

        if (user.status !== 'Active') {
            return res.status(403).json({
                message: 'Account is not active',
                error: true,
                success: false
            });
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        user.otp = resetCode;
        user.otp_expiry = Date.now() + 10 * 60 * 1000;
        await user.save();

        try {
            await sendVerificationEmail({
                sendTo: user.email,
                subject: 'Password Reset Request - E-Commerce App',
                text: 'You requested a password reset. Use the OTP code to reset your password.',
                html: ForgotPasswordTemplate(user.name, resetCode)
            });

            return res.status(200).json({
                message: 'Password reset code sent to your email',
                error: false,
                success: true
            });

        } catch (emailError) {
            console.error('Failed to send reset email:', emailError);
            
            user.otp = null;
            user.otp_expiry = null;
            await user.save();

            return res.status(500).json({
                message: 'Failed to send password reset email. Please try again.',
                error: true,
                success: false
            });
        }

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Internal server error',
            error: true,
            success: false
        });
    }
}

// Verify Reset Code Controller
export async function verifyResetCodeController(req, res) {
    try {
        const { email, otp } = req.body;

        // Validate inputs
        if (!email || !otp) {
            return res.status(400).json({
                message: 'Email and OTP are required',
                error: true,
                success: false
            });
        }

        // Find user
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        // Verify OTP
        const isCodeValid = user.otp === otp;
        const isNotExpired = user.otp_expiry > Date.now();

        if (!isCodeValid || !isNotExpired) {
            return res.status(400).json({
                message: 'Invalid or expired OTP',
                error: true,
                success: false
            });
        }

        // Generate temporary token for password reset
        const resetToken = jwt.sign(
            { email: user.email, id: user._id, purpose: 'password-reset' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // 15 minutes to complete password reset
        );

        return res.status(200).json({
            message: 'OTP verified successfully',
            error: false,
            success: true,
            resetToken
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Internal server error',
            error: true,
            success: false
        });
    }
}

// Reset Password Controller
export async function resetPasswordController(req, res) {
    try {
        const { resetToken, newPassword } = req.body;

        // Validate inputs
        if (!resetToken || !newPassword) {
            return res.status(400).json({
                message: 'Reset token and new password are required',
                error: true,
                success: false
            });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters long',
                error: true,
                success: false
            });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
            
            // Check if token is for password reset
            if (decoded.purpose !== 'password-reset') {
                throw new Error('Invalid token purpose');
            }
        } catch (jwtError) {
            return res.status(401).json({
                message: 'Invalid or expired reset token',
                error: true,
                success: false
            });
        }

        // Find user
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.otp = null;
        user.otp_expiry = null;
        user.refresh_token = ""; // Clear refresh token for security
        await user.save();

        return res.status(200).json({
            message: 'Password reset successfully. Please login with your new password.',
            error: false,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Internal server error',
            error: true,
            success: false
        });
    }
}

// Refresh Token Controller
export async function refreshTokenController(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                message: 'Refresh token is required',
                error: true,
                success: false
            });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.SECRET_KEY_REFRESH_TOKEN);
        } catch (jwtError) {
            return res.status(401).json({
                message: 'Invalid or expired refresh token',
                error: true,
                success: false
            });
        }

        // Find user and check if refresh token matches
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }

        // Verify the refresh token matches the one stored in database
        if (user.refresh_token !== refreshToken) {
            return res.status(401).json({
                message: 'Invalid refresh token',
                error: true,
                success: false
            });
        }

        // Check if user account is active
        if (user.status !== 'Active') {
            return res.status(403).json({
                message: 'User account is not active',
                error: true,
                success: false
            });
        }

        // Generate new access token
        const newAccessToken = await generateAccessToken(user);

        // Optionally generate new refresh token for rotation
        const newRefreshToken = await generateRefreshToken(user);

        // Set cookies
        const cookiesOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
        };

        res.cookie('accessToken', newAccessToken, cookiesOptions);
        res.cookie('refreshToken', newRefreshToken, cookiesOptions);

        return res.status(200).json({
            message: 'Token refreshed successfully',
            error: false,
            success: true,
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Internal server error',
            error: true,
            success: false
        });
    }
}

// Change Password Controller (Optional)
export async function changePasswordController(req, res) {
    try {
        const userId = req.userId; // From auth middleware
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Current and new passwords are required',
                error: true,
                success: false
            });
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                error: true,
                success: false
            });
        }
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Current password is incorrect',
                error: true,
                success: false
            });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        return res.status(200).json({
            message: 'Password changed successfully',
            error: false,
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Internal server error',
            error: true,
            success: false
        });
    }
}