import CategoryModel from '../models/category.model.js';
import { uploadCategoryImage, deleteImage } from '../utils/cloudinary.js';
import fs from 'fs';

// Create a new category
export async function createCategory(req, res) {
    try {
        const { 
            name, 
            description, 
            status, 
            parentCatName, 
            parentCategory 
        } = req.body;

        const files = req.files; // Multiple image files from multer

        // Validation
        if (!name || name.trim() === '') {
            // Cleanup uploaded files
            if (files && files.length > 0) {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            return res.status(400).json({
                message: 'Category name is required',
                error: true,
                success: false
            });
        }

        // Check if category name already exists
        const existingCategory = await CategoryModel.findOne({ 
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
        });

        if (existingCategory) {
            // Cleanup uploaded files
            if (files && files.length > 0) {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            return res.status(409).json({
                message: 'Category name already exists',
                error: true,
                success: false
            });
        }

        // Generate slug from name
        const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

        // Validate parent category if provided
        if (parentCategory) {
            const parentExists = await CategoryModel.findById(parentCategory);
            if (!parentExists) {
                // Cleanup uploaded files
                if (files && files.length > 0) {
                    files.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    });
                }
                return res.status(404).json({
                    message: 'Parent category not found',
                    error: true,
                    success: false
                });
            }
        }

        // Create new category object
        const newCategory = new CategoryModel({
            name: name.trim(),
            slug,
            description: description?.trim() || '',
            status: status || 'active',
            parentCatName: parentCatName?.trim() || null,
            parentCategory: parentCategory || null,
            images: []
        });

        // Upload images to Cloudinary if provided
        if (files && files.length > 0) {
            try {
                // Upload all images in parallel
                const uploadPromises = files.map(file => 
                    uploadCategoryImage(file.path, newCategory._id.toString())
                );
                
                const uploadedImages = await Promise.all(uploadPromises);

                // Add uploaded images to category
                newCategory.images = uploadedImages.map(img => ({
                    url: img.url,
                    public_id: img.publicId
                }));

            } catch (uploadError) {
                // If upload fails, cleanup and return error
                console.error('Image upload error:', uploadError);
                
                return res.status(500).json({
                    message: 'Failed to upload images',
                    error: true,
                    success: false,
                    details: uploadError.message
                });
            }
        }

        // Save category to database
        await newCategory.save();

        // Populate parent category info if exists
        const populatedCategory = await CategoryModel.findById(newCategory._id)
            .populate('parentCategory', 'name slug');

        return res.status(201).json({
            message: 'Category created successfully',
            error: false,
            success: true,
            data: populatedCategory
        });

    } catch (error) {
        // Cleanup uploaded files on error
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages.join(', '),
                error: true,
                success: false
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({
                message: `${field} already exists`,
                error: true,
                success: false
            });
        }

        return res.status(500).json({
            message: error.message || 'Failed to create category',
            error: true,
            success: false
        });
    }
}

// Upload images to existing category
export async function uploadImages(req, res) {
    try {
        const { categoryId } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                message: 'No image files provided',
                error: true,
                success: false
            });
        }

        if (!categoryId) {
            // Cleanup uploaded files
            files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            return res.status(400).json({
                message: 'Category ID is required',
                error: true,
                success: false
            });
        }

        // Find category
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            // Cleanup uploaded files
            files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
            return res.status(404).json({
                message: 'Category not found',
                error: true,
                success: false
            });
        }

        // Upload images to Cloudinary
        const uploadPromises = files.map(file => 
            uploadCategoryImage(file.path, categoryId)
        );
        
        const uploadedImages = await Promise.all(uploadPromises);

        // Add new images to category
        const newImages = uploadedImages.map(img => ({
            url: img.url,
            public_id: img.publicId
        }));

        category.images.push(...newImages);
        await category.save();

        return res.status(200).json({
            message: 'Images uploaded successfully',
            error: false,
            success: true,
            data: {
                images: category.images
            }
        });

    } catch (error) {
        // Cleanup local files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        return res.status(500).json({
            message: error.message || 'Failed to upload images',
            error: true,
            success: false
        });
    }
}

// Delete category image
export async function deleteCategoryImage(req, res) {
    try {
        const { categoryId, publicId } = req.body;

        if (!categoryId || !publicId) {
            return res.status(400).json({
                message: 'Category ID and Public ID are required',
                error: true,
                success: false
            });
        }

        // Find category
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                message: 'Category not found',
                error: true,
                success: false
            });
        }

        // Delete from Cloudinary
        const deleted = await deleteImage(publicId);
        if (!deleted) {
            return res.status(404).json({
                message: 'Image not found or already deleted',
                error: true,
                success: false
            });
        }

        // Remove from category images array
        category.images = category.images.filter(
            img => img.public_id !== publicId
        );
        await category.save();

        return res.status(200).json({
            message: 'Image deleted successfully',
            error: false,
            success: true,
            data: {
                images: category.images
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to delete image',
            error: true,
            success: false
        });
    }
}

// Get all categories with pagination, search, and filters
export async function getCategories(req, res) {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            parentCategory = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query object
        const query = {};

        // Search by name or description
        if (search && search.trim() !== '') {
            query.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Filter by status
        if (status && status.trim() !== '') {
            query.status = status;
        }

        // Filter by parent category
        if (parentCategory && parentCategory.trim() !== '') {
            if (parentCategory === 'null' || parentCategory === 'none') {
                // Get root categories (no parent)
                query.parentCategory = null;
            } else {
                // Get subcategories of specific parent
                query.parentCategory = parentCategory;
            }
        }

        // Calculate pagination
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const [categories, totalCategories] = await Promise.all([
            CategoryModel.find(query)
                .populate('parentCategory', 'name slug')
                .sort(sort)
                .skip(skip)
                .limit(limitNumber)
                .lean(),
            CategoryModel.countDocuments(query)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCategories / limitNumber);
        const hasNextPage = pageNumber < totalPages;
        const hasPrevPage = pageNumber > 1;

        return res.status(200).json({
            message: 'Categories retrieved successfully',
            error: false,
            success: true,
            data: {
                categories,
                pagination: {
                    currentPage: pageNumber,
                    totalPages,
                    totalCategories,
                    limit: limitNumber,
                    hasNextPage,
                    hasPrevPage
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to get categories',
            error: true,
            success: false
        });
    }
}

// Get single category by ID
export async function getCategoryById(req, res) {
    try {
        const { categoryId } = req.params;

        if (!categoryId) {
            return res.status(400).json({
                message: 'Category ID is required',
                error: true,
                success: false
            });
        }

        const category = await CategoryModel.findById(categoryId)
            .populate('parentCategory', 'name slug')
            .lean();

        if (!category) {
            return res.status(404).json({
                message: 'Category not found',
                error: true,
                success: false
            });
        }

        // Get subcategories
        const subcategories = await CategoryModel.find({ 
            parentCategory: categoryId 
        })
        .select('name slug status')
        .lean();

        return res.status(200).json({
            message: 'Category retrieved successfully',
            error: false,
            success: true,
            data: {
                ...category,
                subcategories
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to get category',
            error: true,
            success: false
        });
    }
}

// Get category by slug
export async function getCategoryBySlug(req, res) {
    try {
        const { slug } = req.params;

        if (!slug) {
            return res.status(400).json({
                message: 'Slug is required',
                error: true,
                success: false
            });
        }

        const category = await CategoryModel.findOne({ slug })
            .populate('parentCategory', 'name slug')
            .lean();

        if (!category) {
            return res.status(404).json({
                message: 'Category not found',
                error: true,
                success: false
            });
        }

        // Get subcategories
        const subcategories = await CategoryModel.find({ 
            parentCategory: category._id 
        })
        .select('name slug status')
        .lean();

        return res.status(200).json({
            message: 'Category retrieved successfully',
            error: false,
            success: true,
            data: {
                ...category,
                subcategories
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to get category',
            error: true,
            success: false
        });
    }
}

// Get category tree (hierarchical structure)
export async function getCategoryTree(req, res) {
    try {
        // Get all root categories (no parent)
        const rootCategories = await CategoryModel.find({ 
            parentCategory: null 
        })
        .select('name slug description images status')
        .sort({ name: 1 })
        .lean();

        // Build tree structure
        const categoryTree = await Promise.all(
            rootCategories.map(async (category) => {
                const subcategories = await CategoryModel.find({ 
                    parentCategory: category._id 
                })
                .select('name slug description images status')
                .sort({ name: 1 })
                .lean();

                return {
                    ...category,
                    subcategories
                };
            })
        );

        return res.status(200).json({
            message: 'Category tree retrieved successfully',
            error: false,
            success: true,
            data: categoryTree
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to get category tree',
            error: true,
            success: false
        });
    }
}

// Update category
export async function updateCategory(req, res) {
    try {
        const { categoryId } = req.params;
        const { name, description, status, parentCategory } = req.body;

        if (!categoryId) {
            return res.status(400).json({
                message: 'Category ID is required',
                error: true,
                success: false
            });
        }

        // Find category
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                message: 'Category not found',
                error: true,
                success: false
            });
        }

        // Check if new name already exists (if name is being changed)
        if (name && name.trim() !== category.name) {
            const existingCategory = await CategoryModel.findOne({
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                _id: { $ne: categoryId }
            });

            if (existingCategory) {
                return res.status(409).json({
                    message: 'Category name already exists',
                    error: true,
                    success: false
                });
            }
        }

        // Update fields
        if (name && name.trim() !== '') {
            category.name = name.trim();
            // Regenerate slug
            category.slug = name
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        if (description !== undefined) {
            category.description = description.trim();
        }

        if (status) {
            category.status = status;
        }

        if (parentCategory !== undefined) {
            // Validate parent category if provided
            if (parentCategory && parentCategory !== 'null') {
                // Check if parent exists
                const parentExists = await CategoryModel.findById(parentCategory);
                if (!parentExists) {
                    return res.status(404).json({
                        message: 'Parent category not found',
                        error: true,
                        success: false
                    });
                }

                // Prevent setting itself as parent
                if (parentCategory === categoryId) {
                    return res.status(400).json({
                        message: 'Category cannot be its own parent',
                        error: true,
                        success: false
                    });
                }

                category.parentCategory = parentCategory;
            } else {
                category.parentCategory = null;
            }
        }

        await category.save();

        // Populate and return
        const updatedCategory = await CategoryModel.findById(categoryId)
            .populate('parentCategory', 'name slug');

        return res.status(200).json({
            message: 'Category updated successfully',
            error: false,
            success: true,
            data: updatedCategory
        });

    } catch (error) {
        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages.join(', '),
                error: true,
                success: false
            });
        }

        return res.status(500).json({
            message: error.message || 'Failed to update category',
            error: true,
            success: false
        });
    }
}

// Delete category
export async function deleteCategory(req, res) {
    try {
        const { categoryId } = req.params;

        if (!categoryId) {
            return res.status(400).json({
                message: 'Category ID is required',
                error: true,
                success: false
            });
        }

        // Find category
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                message: 'Category not found',
                error: true,
                success: false
            });
        }

        // Check if category has subcategories
        const subcategories = await CategoryModel.find({ 
            parentCategory: categoryId 
        });

        if (subcategories.length > 0) {
            return res.status(400).json({
                message: 'Cannot delete category with subcategories. Delete subcategories first.',
                error: true,
                success: false,
                subcategoriesCount: subcategories.length
            });
        }

        // Delete all images from Cloudinary
        if (category.images && category.images.length > 0) {
            const deletePromises = category.images.map(img => 
                deleteImage(img.public_id)
            );
            await Promise.all(deletePromises);
        }

        // Delete category
        await CategoryModel.findByIdAndDelete(categoryId);

        return res.status(200).json({
            message: 'Category deleted successfully',
            error: false,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to delete category',
            error: true,
            success: false
        });
    }
}