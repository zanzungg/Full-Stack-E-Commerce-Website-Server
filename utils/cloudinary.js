import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

/**
 * Upload avatar to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} userId - User ID for unique naming
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadAvatar(filePath, userId) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'avatars',
            public_id: `avatar_${userId}_${Date.now()}`,
            overwrite: true,
            transformation: [
                { width: 500, height: 500, crop: 'fill', gravity: 'face' },
                { quality: 'auto:good', fetch_format: 'auto' }
            ]
        });

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } finally {
        // Always cleanup local file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

/**
 * Upload category image to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} categoryId - Category ID for unique naming
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadCategoryImage(filePath, categoryId) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'categories',
            public_id: `category_${categoryId}_${Date.now()}`,
            transformation: [
                { width: 800, height: 600, crop: 'limit' },
                { quality: 'auto:good', fetch_format: 'auto' }
            ]
        });

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } finally {
        // Always cleanup local file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<boolean>}
 */
export async function deleteImage(publicId) {
    if (!publicId) return false;
    
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result.result === 'ok';
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return false;
    }
}

export default cloudinary;