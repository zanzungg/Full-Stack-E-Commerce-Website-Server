import ProductModel from "../models/product.model.js";
import CategoryModel from "../models/category.model.js"; // Thêm import
import fs from 'fs';
import { uploadProductImage, deleteImage } from "../utils/cloudinary.js";
import mongoose from 'mongoose';

/**
 * @desc    Create a new product with images
 * @route   POST /api/products
 * @access  Private/Admin
 */
export async function createProduct(req, res) {
    try {
        const {
            name,
            description,
            brand,
            price,
            oldPrice,
            catName,
            catId,
            subCatId,
            subCat,
            thirdSubCat,
            thirdSubCatId,
            category,
            countInStock,
            rating,
            isFeatured,
            discount,
            productRam,
            size,
            productWeight,
            location
        } = req.body;

        const files = req.files;

        // ================ VALIDATION ================
        
        // 1. Validate required fields
        if (!name?.trim() || !description?.trim() || !price || !category) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Missing required fields',
                error: true,
                success: false,
                details: {
                    name: !name?.trim() ? 'Product name is required' : null,
                    description: !description?.trim() ? 'Description is required' : null,
                    price: !price ? 'Price is required' : null,
                    category: !category ? 'Category is required' : null
                }
            });
        }

        // 2. Validate images
        if (!files || files.length === 0) {
            return res.status(400).json({
                message: 'At least one product image is required',
                error: true,
                success: false
            });
        }

        // 3. Validate image count (max 10 images)
        if (files.length > 10) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Maximum 10 images allowed per product',
                error: true,
                success: false
            });
        }

        // 4. Validate image file types
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const invalidFiles = files.filter(file => !allowedMimeTypes.includes(file.mimetype));
        
        if (invalidFiles.length > 0) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Invalid image format. Only JPEG, JPG, PNG, and WEBP are allowed',
                error: true,
                success: false
            });
        }

        // 5. Validate price
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Price must be a positive number',
                error: true,
                success: false
            });
        }

        // 6. Validate category ObjectId
        if (!mongoose.Types.ObjectId.isValid(category)) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Invalid category ID format',
                error: true,
                success: false
            });
        }

        // 6.1. Check if category exists in database
        const categoryExists = await CategoryModel.findById(category);
        if (!categoryExists) {
            cleanupUploadedFiles(files);
            return res.status(404).json({
                message: 'Category not found. Please provide a valid category ID',
                error: true,
                success: false
            });
        }

        // 7. Validate discount
        const discountNum = discount ? parseFloat(discount) : 0;
        if (discountNum < 0 || discountNum > 100) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Discount must be between 0 and 100',
                error: true,
                success: false
            });
        }

        // 8. Validate stock count
        const stockNum = countInStock ? parseInt(countInStock) : 0;
        if (isNaN(stockNum) || stockNum < 0) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Stock count must be a non-negative number',
                error: true,
                success: false
            });
        }

        // ================ PARSE ARRAYS ================
        
        const parseArrayField = (field) => {
            if (!field) return [];
            try {
                if (Array.isArray(field)) return field;
                if (typeof field === 'string') {
                    // Handle both JSON string and comma-separated string
                    return field.includes('[') ? JSON.parse(field) : field.split(',').map(item => item.trim()).filter(Boolean);
                }
                return [];
            } catch (error) {
                console.error(`Error parsing array field:`, error);
                return [];
            }
        };

        const parsedProductRam = parseArrayField(productRam);
        const parsedSize = parseArrayField(size);
        const parsedProductWeight = parseArrayField(productWeight);
        
        // Parse location with special handling for objects
        let parsedLocation = [];
        try {
            if (location) {
                if (Array.isArray(location)) {
                    parsedLocation = location;
                } else if (typeof location === 'string') {
                    parsedLocation = JSON.parse(location);
                }
            }
        } catch (error) {
            console.error('Error parsing location:', error);
        }

        // ================ CREATE PRODUCT ================
        
        const productData = {
            name: name.trim(),
            description: description.trim(),
            brand: brand?.trim() || '',
            price: priceNum,
            oldPrice: oldPrice ? parseFloat(oldPrice) : 0,
            catName: catName?.trim() || '',
            catId: catId || '',
            subCatId: subCatId || '',
            subCat: subCat?.trim() || '',
            thirdSubCat: thirdSubCat?.trim() || '',
            thirdSubCatId: thirdSubCatId || '',
            category,
            countInStock: stockNum,
            rating: rating ? parseFloat(rating) : 0,
            isFeatured: isFeatured === 'true' || isFeatured === true || isFeatured === 1,
            discount: discountNum,
            productRam: parsedProductRam,
            size: parsedSize,
            productWeight: parsedProductWeight,
            location: parsedLocation,
            images: [] // Will be populated after upload
        };

        // Create product first
        const product = new ProductModel(productData);
        
        // ================ UPLOAD IMAGES TO CLOUDINARY ================
        
        let uploadedImages = [];
        let uploadErrors = [];

        try {
            // Upload all images in parallel
            const uploadPromises = files.map(async (file, index) => {
                try {
                    const result = await uploadProductImage(file.path, product._id.toString());
                    return {
                        url: result.url,
                        public_id: result.publicId,
                        index
                    };
                } catch (error) {
                    uploadErrors.push({
                        file: file.originalname,
                        error: error.message
                    });
                    return null;
                }
            });
            
            const results = await Promise.all(uploadPromises);
            uploadedImages = results.filter(result => result !== null);

            // Check if at least one image was uploaded successfully
            if (uploadedImages.length === 0) {
                throw new Error('Failed to upload any images to Cloudinary');
            }

            // Add images to product
            product.images = uploadedImages.map(img => ({
                url: img.url,
                public_id: img.public_id
            }));

            // Save product with images
            await product.save();

            // Cleanup local files after successful upload
            cleanupUploadedFiles(files);

            // Prepare response
            const response = {
                message: 'Product created successfully',
                error: false,
                success: true,
                data: product
            };

            // Add warning if some images failed
            if (uploadErrors.length > 0) {
                response.warning = `${uploadErrors.length} image(s) failed to upload`;
                response.uploadErrors = uploadErrors;
            }

            return res.status(201).json(response);

        } catch (uploadError) {
            // Rollback: Delete uploaded images from Cloudinary
            if (uploadedImages.length > 0) {
                const deletePromises = uploadedImages.map(img => 
                    deleteImage(img.public_id).catch(err => 
                        console.error(`Failed to delete image ${img.public_id}:`, err)
                    )
                );
                await Promise.all(deletePromises);
            }

            // Cleanup local files
            cleanupUploadedFiles(files);

            throw uploadError;
        }

    } catch (error) {
        // Cleanup local files on error
        if (req.files) {
            cleanupUploadedFiles(req.files);
        }

        console.error('Create Product Error:', error);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation failed',
                error: true,
                success: false,
                details: errors
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Product with this name already exists',
                error: true,
                success: false
            });
        }

        return res.status(500).json({
            message: error.message || 'Failed to create product',
            error: true,
            success: false
        });
    }
}

/**
 * Helper function to cleanup uploaded files
 */
function cleanupUploadedFiles(files) {
    if (!files || files.length === 0) return;
    
    files.forEach(file => {
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (error) {
            console.error(`Failed to delete file ${file.path}:`, error);
        }
    });
}

/**
 * @desc    Upload additional images to an existing product
 * @route   POST /api/products/upload-images
 * @access  Private/Admin
 */
export async function uploadImages(req, res) {
    try {
        const { productId } = req.body;
        const files = req.files;

        // Validate files
        if (!files || files.length === 0) {
            return res.status(400).json({
                message: 'No image files provided',
                error: true,
                success: false
            });
        }

        // Validate productId
        if (!productId) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Product ID is required',
                error: true,
                success: false
            });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: 'Invalid product ID format',
                error: true,
                success: false
            });
        }

        // Find product
        const product = await ProductModel.findById(productId);
        if (!product) {
            cleanupUploadedFiles(files);
            return res.status(404).json({
                message: 'Product not found',
                error: true,
                success: false
            });
        }

        // Check total image count (max 10)
        if (product.images.length + files.length > 10) {
            cleanupUploadedFiles(files);
            return res.status(400).json({
                message: `Cannot upload ${files.length} images. Maximum 10 images per product (current: ${product.images.length})`,
                error: true,
                success: false
            });
        }

        // Upload images to Cloudinary
        const uploadPromises = files.map(file => 
            uploadProductImage(file.path, productId)
        );
        
        const uploadedImages = await Promise.all(uploadPromises);

        // Add new images to product
        const newImages = uploadedImages.map(img => ({
            url: img.url,
            public_id: img.publicId
        }));

        product.images.push(...newImages);
        await product.save();

        // Cleanup local files
        cleanupUploadedFiles(files);

        return res.status(200).json({
            message: 'Images uploaded successfully',
            error: false,
            success: true,
            data: {
                images: product.images,
                totalImages: product.images.length
            }
        });

    } catch (error) {
        // Cleanup local files on error
        if (req.files) {
            cleanupUploadedFiles(req.files);
        }

        console.error('Upload Images Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to upload images',
            error: true,
            success: false
        });
    }
}
