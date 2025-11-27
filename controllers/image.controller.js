import { deleteImage } from "../utils/cloudinary.js";
import fs from "fs";

// Delete Image Controller
export async function deleteImageController(req, res) {
    try {
        const { publicId } = req.body;

        if (!publicId) {
            return res.status(400).json({
                message: 'Public ID is required',
                error: true,
                success: false
            });
        }

        const deleted = await deleteImage(publicId);

        if (!deleted) {
            return res.status(404).json({
                message: 'Image not found or already deleted',
                error: true,
                success: false
            });
        }

        return res.status(200).json({
            message: 'Image deleted successfully',
            error: false,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to delete image',
            error: true,
            success: false
        });
    }
}