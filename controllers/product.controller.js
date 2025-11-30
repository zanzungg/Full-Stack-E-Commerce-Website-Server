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

/**
 * @desc    Get all products (with pagination and filtering)
 * @route   GET /api/products
 * @access  Public
 */
export async function getAllProducts(req, res) {
    try {
        // ================ EXTRACT QUERY PARAMETERS ================
        const {
            page = 1,
            limit = 10,
            sort = '-createdAt',
            search = '',
            category,
            catId,
            subCatId,
            thirdSubCatId,
            brand,
            minPrice,
            maxPrice,
            isFeatured,
            inStock,
            rating,
            location,
            discount,
            productRam,
            size,
            productWeight
        } = req.query;

        // ================ VALIDATE QUERY PARAMETERS ================
        
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                message: 'Invalid page number. Must be a positive integer',
                error: true,
                success: false
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                message: 'Invalid limit. Must be between 1 and 100',
                error: true,
                success: false
            });
        }

        // ================ BUILD FILTER OBJECT ================
        
        const filter = {};

        // Text search (name and description)
        if (search && search.trim()) {
            filter.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } },
                { brand: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Category filters
        if (category) {
            if (mongoose.Types.ObjectId.isValid(category)) {
                filter.category = category;
            }
        }

        if (catId) {
            filter.catId = catId;
        }

        if (subCatId) {
            filter.subCatId = subCatId;
        }

        if (thirdSubCatId) {
            filter.thirdSubCatId = thirdSubCatId;
        }

        // Brand filter
        if (brand) {
            filter.brand = { $regex: brand.trim(), $options: 'i' };
        }

        // Price range filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) {
                const minPriceNum = parseFloat(minPrice);
                if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                    filter.price.$gte = minPriceNum;
                }
            }
            if (maxPrice) {
                const maxPriceNum = parseFloat(maxPrice);
                if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                    filter.price.$lte = maxPriceNum;
                }
            }
        }

        // Featured products filter
        if (isFeatured !== undefined) {
            filter.isFeatured = isFeatured === 'true' || isFeatured === true;
        }

        // In stock filter
        if (inStock !== undefined) {
            if (inStock === 'true' || inStock === true) {
                filter.countInStock = { $gt: 0 };
            } else {
                filter.countInStock = 0;
            }
        }

        // Rating filter
        if (rating) {
            const ratingNum = parseFloat(rating);
            if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
                filter.rating = { $gte: ratingNum };
            }
        }

        // Location filter
        if (location) {
            filter['location.value'] = { $regex: location.trim(), $options: 'i' };
        }

        // Discount filter
        if (discount) {
            const discountNum = parseFloat(discount);
            if (!isNaN(discountNum) && discountNum >= 0) {
                filter.discount = { $gte: discountNum };
            }
        }

        // Product RAM filter
        if (productRam) {
            filter.productRam = { $in: productRam.split(',').map(ram => ram.trim()) };
        }

        // Size filter
        if (size) {
            filter.size = { $in: size.split(',').map(s => s.trim()) };
        }

        // Product weight filter
        if (productWeight) {
            filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };
        }

        // ================ BUILD SORT OBJECT ================
        
        let sortObj = {};
        
        // Parse sort parameter (format: field or -field for descending)
        if (sort) {
            const sortFields = sort.split(',');
            sortFields.forEach(field => {
                if (field.startsWith('-')) {
                    sortObj[field.substring(1)] = -1; // Descending
                } else {
                    sortObj[field] = 1; // Ascending
                }
            });
        } else {
            sortObj = { createdAt: -1 }; // Default sort by newest
        }

        // ================ EXECUTE QUERY ================
        
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const totalProducts = await ProductModel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limitNum);

        // Get products with pagination
        const products = await ProductModel
            .find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name slug color') // Populate category details
            .select('-__v') // Exclude version key
            .lean(); // Convert to plain JavaScript objects for better performance

        // ================ PREPARE RESPONSE ================
        
        return res.status(200).json({
            message: 'Products retrieved successfully',
            error: false,
            success: true,
            data: products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalProducts,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null
            },
            filters: {
                search: search || null,
                category: category || null,
                catId: catId || null,
                subCatId: subCatId || null,
                thirdSubCatId: thirdSubCatId || null,
                brand: brand || null,
                priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
                isFeatured: isFeatured !== undefined ? isFeatured : null,
                inStock: inStock !== undefined ? inStock : null,
                rating: rating || null,
                discount: discount || null
            }
        });

    } catch (error) {
        console.error('Get All Products Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve products',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
export async function getProductById(req, res) {
    try {
        const { id } = req.params;

        // Validate product ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid product ID format',
                error: true,
                success: false
            });
        }

        // Find product
        const product = await ProductModel
            .findById(id)
            .populate('category', 'name slug color')
            .lean();

        if (!product) {
            return res.status(404).json({
                message: 'Product not found',
                error: true,
                success: false
            });
        }

        return res.status(200).json({
            message: 'Product retrieved successfully',
            error: false,
            success: true,
            data: product
        });

    } catch (error) {
        console.error('Get Product By ID Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve product',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
export async function getFeaturedProducts(req, res) {
    try {
        const { limit = 10 } = req.query;
        const limitNum = parseInt(limit);

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
            return res.status(400).json({
                message: 'Invalid limit. Must be between 1 and 50',
                error: true,
                success: false
            });
        }

        const products = await ProductModel
            .find({ isFeatured: true })
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .populate('category', 'name slug color')
            .select('-__v')
            .lean();

        return res.status(200).json({
            message: 'Featured products retrieved successfully',
            error: false,
            success: true,
            data: products,
            count: products.length
        });

    } catch (error) {
        console.error('Get Featured Products Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve featured products',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get products by category
 * @route   GET /api/products/category/:categoryId
 * @access  Public
 */
export async function getProductsByCategory(req, res) {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

        // Validate category ID
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                message: 'Invalid category ID format',
                error: true,
                success: false
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        let sortObj = {};
        if (sort.startsWith('-')) {
            sortObj[sort.substring(1)] = -1;
        } else {
            sortObj[sort] = 1;
        }

        const totalProducts = await ProductModel.countDocuments({ category: categoryId });
        const totalPages = Math.ceil(totalProducts / limitNum);

        const products = await ProductModel
            .find({ category: categoryId })
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name slug color')
            .select('-__v')
            .lean();

        return res.status(200).json({
            message: 'Products retrieved successfully',
            error: false,
            success: true,
            data: products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalProducts,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });

    } catch (error) {
        console.error('Get Products By Category Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve products',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get all products by catId
 * @route   GET /api/products/catId/:catId
 * @access  Public
 */
export async function getProductsByCatId(req, res) {
    try {
        const { catId } = req.params;
        const {
            page = 1,
            limit = 10,
            sort = '-createdAt',
            minPrice,
            maxPrice,
            brand,
            rating,
            inStock,
            discount,
            productRam,
            size,
            productWeight,
            location
        } = req.query;

        // ================ VALIDATE PARAMETERS ================
        
        if (!catId || !catId.trim()) {
            return res.status(400).json({
                message: 'Category ID is required',
                error: true,
                success: false
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                message: 'Invalid page number. Must be a positive integer',
                error: true,
                success: false
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                message: 'Invalid limit. Must be between 1 and 100',
                error: true,
                success: false
            });
        }

        // ================ BUILD FILTER OBJECT ================
        
        const filter = { catId: catId.trim() };

        // Price range filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) {
                const minPriceNum = parseFloat(minPrice);
                if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                    filter.price.$gte = minPriceNum;
                }
            }
            if (maxPrice) {
                const maxPriceNum = parseFloat(maxPrice);
                if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                    filter.price.$lte = maxPriceNum;
                }
            }
        }

        // Brand filter
        if (brand) {
            filter.brand = { $regex: brand.trim(), $options: 'i' };
        }

        // Rating filter
        if (rating) {
            const ratingNum = parseFloat(rating);
            if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
                filter.rating = { $gte: ratingNum };
            }
        }

        // In stock filter
        if (inStock !== undefined) {
            if (inStock === 'true' || inStock === true) {
                filter.countInStock = { $gt: 0 };
            } else if (inStock === 'false' || inStock === false) {
                filter.countInStock = 0;
            }
        }

        // Discount filter
        if (discount) {
            const discountNum = parseFloat(discount);
            if (!isNaN(discountNum) && discountNum >= 0) {
                filter.discount = { $gte: discountNum };
            }
        }

        // Product RAM filter (multiple values)
        if (productRam) {
            filter.productRam = { $in: productRam.split(',').map(ram => ram.trim()) };
        }

        // Size filter (multiple values)
        if (size) {
            filter.size = { $in: size.split(',').map(s => s.trim()) };
        }

        // Product weight filter (multiple values)
        if (productWeight) {
            filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };
        }

        // Location filter
        if (location) {
            filter['location.value'] = { $regex: location.trim(), $options: 'i' };
        }

        // ================ BUILD SORT OBJECT ================
        
        let sortObj = {};
        
        if (sort) {
            const sortFields = sort.split(',');
            sortFields.forEach(field => {
                if (field.startsWith('-')) {
                    sortObj[field.substring(1)] = -1; // Descending
                } else {
                    sortObj[field] = 1; // Ascending
                }
            });
        } else {
            sortObj = { createdAt: -1 }; // Default: newest first
        }

        // ================ EXECUTE QUERY ================
        
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const totalProducts = await ProductModel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limitNum);

        // Return 404 if no products found on first page
        if (totalProducts === 0 && pageNum === 1) {
            return res.status(404).json({
                message: 'No products found for this category ID',
                error: true,
                success: false,
                data: [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: 0,
                    totalProducts: 0,
                    limit: limitNum,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: null,
                    prevPage: null
                }
            });
        }

        // Get products with pagination
        const products = await ProductModel
            .find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name slug color')
            .select('-__v')
            .lean();

        // ================ GET FILTER AGGREGATIONS ================
        
        // Get available brands for this catId
        const availableBrands = await ProductModel.distinct('brand', { catId: catId.trim(), brand: { $ne: '' } });
        
        // Get price range
        const priceRange = await ProductModel.aggregate([
            { $match: { catId: catId.trim() } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ]);

        // Get available RAM options
        const availableRam = await ProductModel.distinct('productRam', { catId: catId.trim() });
        
        // Get available sizes
        const availableSizes = await ProductModel.distinct('size', { catId: catId.trim() });

        // ================ PREPARE RESPONSE ================
        
        return res.status(200).json({
            message: 'Products retrieved successfully',
            error: false,
            success: true,
            data: products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalProducts,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null
            },
            appliedFilters: {
                catId: catId.trim(),
                brand: brand || null,
                priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
                rating: rating || null,
                inStock: inStock !== undefined ? inStock : null,
                discount: discount || null,
                productRam: productRam || null,
                size: size || null,
                productWeight: productWeight || null,
                location: location || null
            },
            availableFilters: {
                brands: availableBrands.sort(),
                priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
                ramOptions: availableRam.flat().filter(Boolean).sort(),
                sizeOptions: availableSizes.flat().filter(Boolean).sort()
            }
        });

    } catch (error) {
        console.error('Get Products By CatId Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve products',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get all products by subCatId (with advanced filtering)
 * @route   GET /api/products/subCatId/:subCatId
 * @access  Public
 */
export async function getProductsBySubCatId(req, res) {
    try {
        const { subCatId } = req.params;
        const {
            page = 1,
            limit = 10,
            sort = '-createdAt',
            minPrice,
            maxPrice,
            brand,
            rating,
            inStock,
            discount,
            productRam,
            size,
            productWeight
        } = req.query;

        // ================ VALIDATE PARAMETERS ================
        
        if (!subCatId || !subCatId.trim()) {
            return res.status(400).json({
                message: 'Sub-category ID is required',
                error: true,
                success: false
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                message: 'Invalid page number. Must be a positive integer',
                error: true,
                success: false
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                message: 'Invalid limit. Must be between 1 and 100',
                error: true,
                success: false
            });
        }

        // ================ BUILD FILTER OBJECT ================
        
        const filter = { subCatId: subCatId.trim() };

        // Price range filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) {
                const minPriceNum = parseFloat(minPrice);
                if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                    filter.price.$gte = minPriceNum;
                }
            }
            if (maxPrice) {
                const maxPriceNum = parseFloat(maxPrice);
                if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                    filter.price.$lte = maxPriceNum;
                }
            }
        }

        // Brand filter
        if (brand) {
            filter.brand = { $regex: brand.trim(), $options: 'i' };
        }

        // Rating filter
        if (rating) {
            const ratingNum = parseFloat(rating);
            if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
                filter.rating = { $gte: ratingNum };
            }
        }

        // In stock filter
        if (inStock !== undefined) {
            if (inStock === 'true' || inStock === true) {
                filter.countInStock = { $gt: 0 };
            } else if (inStock === 'false' || inStock === false) {
                filter.countInStock = 0;
            }
        }

        // Discount filter
        if (discount) {
            const discountNum = parseFloat(discount);
            if (!isNaN(discountNum) && discountNum >= 0) {
                filter.discount = { $gte: discountNum };
            }
        }

        // Product RAM filter
        if (productRam) {
            filter.productRam = { $in: productRam.split(',').map(ram => ram.trim()) };
        }

        // Size filter
        if (size) {
            filter.size = { $in: size.split(',').map(s => s.trim()) };
        }

        // Product weight filter
        if (productWeight) {
            filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };
        }

        // ================ BUILD SORT OBJECT ================
        
        let sortObj = {};
        
        if (sort) {
            const sortFields = sort.split(',');
            sortFields.forEach(field => {
                if (field.startsWith('-')) {
                    sortObj[field.substring(1)] = -1;
                } else {
                    sortObj[field] = 1;
                }
            });
        } else {
            sortObj = { createdAt: -1 };
        }

        // ================ EXECUTE QUERY ================
        
        const skip = (pageNum - 1) * limitNum;

        const totalProducts = await ProductModel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limitNum);

        if (totalProducts === 0 && pageNum === 1) {
            return res.status(404).json({
                message: 'No products found for this sub-category ID',
                error: true,
                success: false,
                data: [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: 0,
                    totalProducts: 0,
                    limit: limitNum,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            });
        }

        const products = await ProductModel
            .find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name slug color')
            .select('-__v')
            .lean();

        // ================ GET FILTER AGGREGATIONS ================
        
        const availableBrands = await ProductModel.distinct('brand', { subCatId: subCatId.trim(), brand: { $ne: '' } });
        
        const priceRange = await ProductModel.aggregate([
            { $match: { subCatId: subCatId.trim() } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ]);

        const availableRam = await ProductModel.distinct('productRam', { subCatId: subCatId.trim() });
        const availableSizes = await ProductModel.distinct('size', { subCatId: subCatId.trim() });

        // ================ PREPARE RESPONSE ================
        
        return res.status(200).json({
            message: 'Products retrieved successfully',
            error: false,
            success: true,
            data: products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalProducts,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null
            },
            appliedFilters: {
                subCatId: subCatId.trim(),
                brand: brand || null,
                priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
                rating: rating || null,
                inStock: inStock !== undefined ? inStock : null,
                discount: discount || null,
                productRam: productRam || null,
                size: size || null,
                productWeight: productWeight || null
            },
            availableFilters: {
                brands: availableBrands.sort(),
                priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
                ramOptions: availableRam.flat().filter(Boolean).sort(),
                sizeOptions: availableSizes.flat().filter(Boolean).sort()
            }
        });

    } catch (error) {
        console.error('Get Products By SubCatId Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve products',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get all products by thirdSubCatId (with advanced filtering)
 * @route   GET /api/products/thirdSubCatId/:thirdSubCatId
 * @access  Public
 */
export async function getProductsByThirdSubCatId(req, res) {
    try {
        const { thirdSubCatId } = req.params;
        const {
            page = 1,
            limit = 10,
            sort = '-createdAt',
            minPrice,
            maxPrice,
            brand,
            rating,
            inStock,
            discount,
            productRam,
            size,
            productWeight
        } = req.query;

        // ================ VALIDATE PARAMETERS ================
        
        if (!thirdSubCatId || !thirdSubCatId.trim()) {
            return res.status(400).json({
                message: 'Third sub-category ID is required',
                error: true,
                success: false
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                message: 'Invalid page number. Must be a positive integer',
                error: true,
                success: false
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                message: 'Invalid limit. Must be between 1 and 100',
                error: true,
                success: false
            });
        }

        // ================ BUILD FILTER OBJECT ================
        
        const filter = { thirdSubCatId: thirdSubCatId.trim() };

        // Price range filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) {
                const minPriceNum = parseFloat(minPrice);
                if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                    filter.price.$gte = minPriceNum;
                }
            }
            if (maxPrice) {
                const maxPriceNum = parseFloat(maxPrice);
                if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                    filter.price.$lte = maxPriceNum;
                }
            }
        }

        // Brand filter
        if (brand) {
            filter.brand = { $regex: brand.trim(), $options: 'i' };
        }

        // Rating filter
        if (rating) {
            const ratingNum = parseFloat(rating);
            if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
                filter.rating = { $gte: ratingNum };
            }
        }

        // In stock filter
        if (inStock !== undefined) {
            if (inStock === 'true' || inStock === true) {
                filter.countInStock = { $gt: 0 };
            } else if (inStock === 'false' || inStock === false) {
                filter.countInStock = 0;
            }
        }

        // Discount filter
        if (discount) {
            const discountNum = parseFloat(discount);
            if (!isNaN(discountNum) && discountNum >= 0) {
                filter.discount = { $gte: discountNum };
            }
        }

        // Product RAM filter
        if (productRam) {
            filter.productRam = { $in: productRam.split(',').map(ram => ram.trim()) };
        }

        // Size filter
        if (size) {
            filter.size = { $in: size.split(',').map(s => s.trim()) };
        }

        // Product weight filter
        if (productWeight) {
            filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };
        }

        // ================ BUILD SORT OBJECT ================
        
        let sortObj = {};
        
        if (sort) {
            const sortFields = sort.split(',');
            sortFields.forEach(field => {
                if (field.startsWith('-')) {
                    sortObj[field.substring(1)] = -1;
                } else {
                    sortObj[field] = 1;
                }
            });
        } else {
            sortObj = { createdAt: -1 };
        }

        // ================ EXECUTE QUERY ================
        
        const skip = (pageNum - 1) * limitNum;

        const totalProducts = await ProductModel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limitNum);

        if (totalProducts === 0 && pageNum === 1) {
            return res.status(404).json({
                message: 'No products found for this third sub-category ID',
                error: true,
                success: false,
                data: [],
                pagination: {
                    currentPage: pageNum,
                    totalPages: 0,
                    totalProducts: 0,
                    limit: limitNum,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            });
        }

        const products = await ProductModel
            .find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name slug color')
            .select('-__v')
            .lean();

        // ================ GET FILTER AGGREGATIONS ================
        
        const availableBrands = await ProductModel.distinct('brand', { 
            thirdSubCatId: thirdSubCatId.trim(), 
            brand: { $ne: '' } 
        });
        
        const priceRange = await ProductModel.aggregate([
            { $match: { thirdSubCatId: thirdSubCatId.trim() } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ]);

        const availableRam = await ProductModel.distinct('productRam', { thirdSubCatId: thirdSubCatId.trim() });
        const availableSizes = await ProductModel.distinct('size', { thirdSubCatId: thirdSubCatId.trim() });

        // ================ PREPARE RESPONSE ================
        
        return res.status(200).json({
            message: 'Products retrieved successfully',
            error: false,
            success: true,
            data: products,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalProducts,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null
            },
            appliedFilters: {
                thirdSubCatId: thirdSubCatId.trim(),
                brand: brand || null,
                priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
                rating: rating || null,
                inStock: inStock !== undefined ? inStock : null,
                discount: discount || null,
                productRam: productRam || null,
                size: size || null,
                productWeight: productWeight || null
            },
            availableFilters: {
                brands: availableBrands.sort(),
                priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
                ramOptions: availableRam.flat().filter(Boolean).sort(),
                sizeOptions: availableSizes.flat().filter(Boolean).sort()
            }
        });

    } catch (error) {
        console.error('Get Products By ThirdSubCatId Error:', error);

        return res.status(500).json({
            message: error.message || 'Failed to retrieve products',
            error: true,
            success: false
        });
    }
}

/**
 * @desc    Get all products by catName (with advanced filtering)
 * @route   GET /api/products/catName/:catName
 * @access  Public
 */
export async function getProductsByCatName(req, res) {
  try {
      const { catName } = req.params;
      const {
          page = 1,
          limit = 10,
          sort = '-createdAt',
          minPrice,
          maxPrice,
          brand,
          rating,
          inStock,
          discount,
          productRam,
          size,
          productWeight,
          location
      } = req.query;

      // ================ VALIDATE PARAMETERS ================
      
      if (!catName || !catName.trim()) {
          return res.status(400).json({
              message: 'Category name is required',
              error: true,
              success: false
          });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({
              message: 'Invalid page number. Must be a positive integer',
              error: true,
              success: false
          });
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          return res.status(400).json({
              message: 'Invalid limit. Must be between 1 and 100',
              error: true,
              success: false
          });
      }

      // ================ BUILD FILTER OBJECT ================
      
      // Decode URL-encoded catName (e.g., "Smart%20Phones" -> "Smart Phones")
      const decodedCatName = decodeURIComponent(catName.trim());
      
      // Case-insensitive regex match for catName
      const filter = { 
          catName: { $regex: `^${decodedCatName}$`, $options: 'i' } 
      };

      // Price range filter
      if (minPrice || maxPrice) {
          filter.price = {};
          if (minPrice) {
              const minPriceNum = parseFloat(minPrice);
              if (!isNaN(minPriceNum) && minPriceNum >= 0) {
                  filter.price.$gte = minPriceNum;
              }
          }
          if (maxPrice) {
              const maxPriceNum = parseFloat(maxPrice);
              if (!isNaN(maxPriceNum) && maxPriceNum >= 0) {
                  filter.price.$lte = maxPriceNum;
              }
          }
      }

      // Brand filter
      if (brand) {
          filter.brand = { $regex: brand.trim(), $options: 'i' };
      }

      // Rating filter
      if (rating) {
          const ratingNum = parseFloat(rating);
          if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
              filter.rating = { $gte: ratingNum };
          }
      }

      // In stock filter
      if (inStock !== undefined) {
          if (inStock === 'true' || inStock === true) {
              filter.countInStock = { $gt: 0 };
          } else if (inStock === 'false' || inStock === false) {
              filter.countInStock = 0;
          }
      }

      // Discount filter
      if (discount) {
          const discountNum = parseFloat(discount);
          if (!isNaN(discountNum) && discountNum >= 0) {
              filter.discount = { $gte: discountNum };
          }
      }

      // Product RAM filter (multiple values)
      if (productRam) {
          filter.productRam = { $in: productRam.split(',').map(ram => ram.trim()) };
      }

      // Size filter (multiple values)
      if (size) {
          filter.size = { $in: size.split(',').map(s => s.trim()) };
      }

      // Product weight filter (multiple values)
      if (productWeight) {
          filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };
      }

      // Location filter
      if (location) {
          filter['location.value'] = { $regex: location.trim(), $options: 'i' };
      }

      // ================ BUILD SORT OBJECT ================
      
      let sortObj = {};
      
      if (sort) {
          const sortFields = sort.split(',');
          sortFields.forEach(field => {
              if (field.startsWith('-')) {
                  sortObj[field.substring(1)] = -1; // Descending
              } else {
                  sortObj[field] = 1; // Ascending
              }
          });
      } else {
          sortObj = { createdAt: -1 }; // Default: newest first
      }

      // ================ EXECUTE QUERY ================
      
      const skip = (pageNum - 1) * limitNum;

      // Get total count
      const totalProducts = await ProductModel.countDocuments(filter);
      const totalPages = Math.ceil(totalProducts / limitNum);

      // Return empty result if no products found
      if (totalProducts === 0 && pageNum === 1) {
          return res.status(200).json({
              message: `No products found for category: ${decodedCatName}`,
              error: false,
              success: true,
              data: [],
              pagination: {
                  currentPage: pageNum,
                  totalPages: 0,
                  totalProducts: 0,
                  limit: limitNum,
                  hasNextPage: false,
                  hasPrevPage: false,
                  nextPage: null,
                  prevPage: null
              },
              appliedFilters: {
                  catName: decodedCatName
              },
              availableFilters: {
                  brands: [],
                  priceRange: { minPrice: 0, maxPrice: 0 },
                  ramOptions: [],
                  sizeOptions: []
              }
          });
      }

      // Get products with pagination
      const products = await ProductModel
          .find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate('category', 'name slug color')
          .select('-__v')
          .lean();

      // ================ GET FILTER AGGREGATIONS ================
      
      // Get available brands for this catName
      const availableBrands = await ProductModel.distinct('brand', { 
          catName: { $regex: `^${decodedCatName}$`, $options: 'i' },
          brand: { $ne: '' } 
      });
      
      // Get price range
      const priceRange = await ProductModel.aggregate([
          { $match: { catName: { $regex: `^${decodedCatName}$`, $options: 'i' } } },
          {
              $group: {
                  _id: null,
                  minPrice: { $min: '$price' },
                  maxPrice: { $max: '$price' }
              }
          }
      ]);

      // Get available RAM options
      const availableRam = await ProductModel.distinct('productRam', { 
          catName: { $regex: `^${decodedCatName}$`, $options: 'i' } 
      });
      
      // Get available sizes
      const availableSizes = await ProductModel.distinct('size', { 
          catName: { $regex: `^${decodedCatName}$`, $options: 'i' } 
      });

      // Get available locations
      const availableLocations = await ProductModel.aggregate([
          { $match: { catName: { $regex: `^${decodedCatName}$`, $options: 'i' } } },
          { $unwind: '$location' },
          { $group: { _id: '$location.value' } },
          { $sort: { _id: 1 } }
      ]);

      // Get subcategories (subCat) under this catName
      const availableSubCats = await ProductModel.distinct('subCat', { 
          catName: { $regex: `^${decodedCatName}$`, $options: 'i' },
          subCat: { $ne: '' }
      });

      // ================ PREPARE RESPONSE ================
      
      return res.status(200).json({
          message: 'Products retrieved successfully',
          error: false,
          success: true,
          data: products,
          pagination: {
              currentPage: pageNum,
              totalPages,
              totalProducts,
              limit: limitNum,
              hasNextPage: pageNum < totalPages,
              hasPrevPage: pageNum > 1,
              nextPage: pageNum < totalPages ? pageNum + 1 : null,
              prevPage: pageNum > 1 ? pageNum - 1 : null
          },
          appliedFilters: {
              catName: decodedCatName,
              brand: brand || null,
              priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
              rating: rating || null,
              inStock: inStock !== undefined ? inStock : null,
              discount: discount || null,
              productRam: productRam || null,
              size: size || null,
              productWeight: productWeight || null,
              location: location || null
          },
          availableFilters: {
              brands: availableBrands.sort(),
              priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
              ramOptions: availableRam.flat().filter(Boolean).sort(),
              sizeOptions: availableSizes.flat().filter(Boolean).sort(),
              locations: availableLocations.map(loc => loc._id).filter(Boolean),
              subCategories: availableSubCats.sort()
          }
      });

  } catch (error) {
      console.error('Get Products By CatName Error:', error);

      return res.status(500).json({
          message: error.message || 'Failed to retrieve products',
          error: true,
          success: false
      });
  }
}

/**
 * @desc    Get all products by subCat (subcategory name)
 * @route   GET /api/products/subCat/:subCat
 * @access  Public
 */
export async function getProductsBySubCat(req, res) {
  try {
      const { subCat } = req.params;
      const {
          page = 1,
          limit = 10,
          sort = '-createdAt',
          minPrice,
          maxPrice,
          brand,
          rating,
          inStock,
          discount,
          productRam,
          size,
          productWeight
      } = req.query;

      // ================ VALIDATE PARAMETERS ================
      
      if (!subCat || !subCat.trim()) {
          return res.status(400).json({
              message: 'Sub-category name is required',
              error: true,
              success: false
          });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({
              message: 'Invalid page number. Must be a positive integer',
              error: true,
              success: false
          });
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          return res.status(400).json({
              message: 'Invalid limit. Must be between 1 and 100',
              error: true,
              success: false
          });
      }

      // ================ BUILD FILTER OBJECT ================
      
      const decodedSubCat = decodeURIComponent(subCat.trim());
      const filter = { 
          subCat: { $regex: `^${decodedSubCat}$`, $options: 'i' } 
      };

      // Apply other filters
      if (minPrice || maxPrice) {
          filter.price = {};
          if (minPrice) filter.price.$gte = parseFloat(minPrice);
          if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
      }

      if (brand) filter.brand = { $regex: brand.trim(), $options: 'i' };
      if (rating) filter.rating = { $gte: parseFloat(rating) };
      
      if (inStock !== undefined) {
          filter.countInStock = inStock === 'true' ? { $gt: 0 } : 0;
      }

      if (discount) filter.discount = { $gte: parseFloat(discount) };
      if (productRam) filter.productRam = { $in: productRam.split(',').map(ram => ram.trim()) };
      if (size) filter.size = { $in: size.split(',').map(s => s.trim()) };
      if (productWeight) filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };

      // ================ BUILD SORT OBJECT ================
      
      let sortObj = {};
      if (sort) {
          const sortFields = sort.split(',');
          sortFields.forEach(field => {
              sortObj[field.startsWith('-') ? field.substring(1) : field] = field.startsWith('-') ? -1 : 1;
          });
      } else {
          sortObj = { createdAt: -1 };
      }

      // ================ EXECUTE QUERY ================
      
      const skip = (pageNum - 1) * limitNum;
      const totalProducts = await ProductModel.countDocuments(filter);
      const totalPages = Math.ceil(totalProducts / limitNum);

      if (totalProducts === 0) {
          return res.status(200).json({
              message: `No products found for sub-category: ${decodedSubCat}`,
              error: false,
              success: true,
              data: [],
              pagination: {
                  currentPage: pageNum,
                  totalPages: 0,
                  totalProducts: 0,
                  limit: limitNum,
                  hasNextPage: false,
                  hasPrevPage: false
              }
          });
      }

      const products = await ProductModel
          .find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate('category', 'name slug color')
          .select('-__v')
          .lean();

      // ================ GET FILTER AGGREGATIONS ================
      
      const subCatRegex = { $regex: `^${decodedSubCat}$`, $options: 'i' };
      
      const availableBrands = await ProductModel.distinct('brand', { 
          subCat: subCatRegex, 
          brand: { $ne: '' } 
      });
      
      const priceRange = await ProductModel.aggregate([
          { $match: { subCat: subCatRegex } },
          { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } }
      ]);

      const availableRam = await ProductModel.distinct('productRam', { subCat: subCatRegex });
      const availableSizes = await ProductModel.distinct('size', { subCat: subCatRegex });
      
      // Get third subcategories under this subCat
      const availableThirdSubCats = await ProductModel.distinct('thirdSubCat', { 
          subCat: subCatRegex,
          thirdSubCat: { $ne: '' }
      });

      // ================ PREPARE RESPONSE ================
      
      return res.status(200).json({
          message: 'Products retrieved successfully',
          error: false,
          success: true,
          data: products,
          pagination: {
              currentPage: pageNum,
              totalPages,
              totalProducts,
              limit: limitNum,
              hasNextPage: pageNum < totalPages,
              hasPrevPage: pageNum > 1,
              nextPage: pageNum < totalPages ? pageNum + 1 : null,
              prevPage: pageNum > 1 ? pageNum - 1 : null
          },
          appliedFilters: {
              subCat: decodedSubCat,
              brand: brand || null,
              priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
              rating: rating || null,
              inStock: inStock !== undefined ? inStock : null,
              discount: discount || null
          },
          availableFilters: {
              brands: availableBrands.sort(),
              priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
              ramOptions: availableRam.flat().filter(Boolean).sort(),
              sizeOptions: availableSizes.flat().filter(Boolean).sort(),
              thirdSubCategories: availableThirdSubCats.sort()
          }
      });

  } catch (error) {
      console.error('Get Products By SubCat Error:', error);

      return res.status(500).json({
          message: error.message || 'Failed to retrieve products',
          error: true,
          success: false
      });
  }
}

/**
 * @desc    Get all products by thirdSubCat (third subcategory name)
 * @route   GET /api/products/thirdSubCat/:thirdSubCat
 * @access  Public
 */
export async function getProductsByThirdSubCat(req, res) {
  try {
      const { thirdSubCat } = req.params;
      const {
          page = 1,
          limit = 10,
          sort = '-createdAt',
          minPrice,
          maxPrice,
          brand,
          rating,
          inStock,
          discount,
          productRam,
          size,
          productWeight
      } = req.query;

      // Validate parameters
      if (!thirdSubCat || !thirdSubCat.trim()) {
          return res.status(400).json({
              message: 'Third sub-category name is required',
              error: true,
              success: false
          });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({
              message: 'Invalid page number. Must be a positive integer',
              error: true,
              success: false
          });
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          return res.status(400).json({
              message: 'Invalid limit. Must be between 1 and 100',
              error: true,
              success: false
          });
      }

      // Build filter
      const decodedThirdSubCat = decodeURIComponent(thirdSubCat.trim());
      const filter = { 
          thirdSubCat: { $regex: `^${decodedThirdSubCat}$`, $options: 'i' } 
      };

      if (minPrice || maxPrice) {
          filter.price = {};
          if (minPrice) filter.price.$gte = parseFloat(minPrice);
          if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
      }

      if (brand) filter.brand = { $regex: brand.trim(), $options: 'i' };
      if (rating) filter.rating = { $gte: parseFloat(rating) };
      if (inStock === 'true') filter.countInStock = { $gt: 0 };
      if (discount) filter.discount = { $gte: parseFloat(discount) };
      if (productRam) filter.productRam = { $in: productRam.split(',').map(r => r.trim()) };
      if (size) filter.size = { $in: size.split(',').map(s => s.trim()) };
      if (productWeight) filter.productWeight = { $in: productWeight.split(',').map(w => w.trim()) };

      // Build sort
      let sortObj = {};
      if (sort) {
          sort.split(',').forEach(field => {
              sortObj[field.startsWith('-') ? field.substring(1) : field] = field.startsWith('-') ? -1 : 1;
          });
      } else {
          sortObj = { createdAt: -1 };
      }

      // Execute query
      const skip = (pageNum - 1) * limitNum;
      const totalProducts = await ProductModel.countDocuments(filter);
      const totalPages = Math.ceil(totalProducts / limitNum);

      const products = await ProductModel
          .find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate('category', 'name slug color')
          .select('-__v')
          .lean();

      // Get aggregations
      const thirdSubCatRegex = { $regex: `^${decodedThirdSubCat}$`, $options: 'i' };
      
      const [availableBrands, priceRange, availableRam, availableSizes] = await Promise.all([
          ProductModel.distinct('brand', { thirdSubCat: thirdSubCatRegex, brand: { $ne: '' } }),
          ProductModel.aggregate([
              { $match: { thirdSubCat: thirdSubCatRegex } },
              { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } }
          ]),
          ProductModel.distinct('productRam', { thirdSubCat: thirdSubCatRegex }),
          ProductModel.distinct('size', { thirdSubCat: thirdSubCatRegex })
      ]);

      return res.status(200).json({
          message: 'Products retrieved successfully',
          error: false,
          success: true,
          data: products,
          pagination: {
              currentPage: pageNum,
              totalPages,
              totalProducts,
              limit: limitNum,
              hasNextPage: pageNum < totalPages,
              hasPrevPage: pageNum > 1,
              nextPage: pageNum < totalPages ? pageNum + 1 : null,
              prevPage: pageNum > 1 ? pageNum - 1 : null
          },
          appliedFilters: {
              thirdSubCat: decodedThirdSubCat,
              brand: brand || null,
              priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : null,
              rating: rating || null,
              inStock: inStock || null,
              discount: discount || null
          },
          availableFilters: {
              brands: availableBrands.sort(),
              priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
              ramOptions: availableRam.flat().filter(Boolean).sort(),
              sizeOptions: availableSizes.flat().filter(Boolean).sort()
          }
      });

  } catch (error) {
      console.error('Get Products By ThirdSubCat Error:', error);

      return res.status(500).json({
          message: error.message || 'Failed to retrieve products',
          error: true,
          success: false
      });
  }
}