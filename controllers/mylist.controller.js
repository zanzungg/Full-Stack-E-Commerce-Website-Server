import MyListModel from "../models/myList.model.js";
import ProductModel from "../models/product.model.js";
import mongoose from "mongoose";

/**
 * @desc Add a product to the user's wishlist
 * @route POST /api/mylist/add
 * @access Private
 */
export const addToMyList = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware
    const { productId } = req.body;

    // Validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    // Check if product exists
    const product = await ProductModel.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check if product already in wishlist
    const existingItem = await MyListModel.findOne({ 
      userId, 
      productId 
    });

    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: "Product already in your wishlist",
        data: existingItem
      });
    }

    const productImageUrl = product.images?.[0]?.url || '';

    // Create new wishlist item
    const myListItem = await MyListModel.create({
      userId,
      productId,
      productTitle: product.name,
      productImage: productImageUrl,
      rating: product.rating || 0,
      price: product.price,
      oldPrice: product.oldPrice || null,
      brand: product.brand,
      discount: product.discount || 0
    });

    // Populate product info to return full details
    await myListItem.populate('productId', 'name price images stock category');

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      data: myListItem
    });

  } catch (error) {
    console.error("Error in addToMyList:", error);

    // Handle duplicate key error (if skipping check existingItem)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Product already in your wishlist"
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * @desc Get the user's wishlist with pagination, filtering, and sorting
 * @route GET /api/mylist
 * @access Private
 */
export const getMyList = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const { 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      brand = null
    } = req.query;

    const query = { userId };
    
    if (brand) {
      query.brand = brand;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      MyListModel.find(query)
        .sort({ [sortBy]: sortOrder })
        .limit(parseInt(limit))
        .skip(skip)
        .populate('productId', 'name price images stock category discount'),
      MyListModel.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully",
      data: {
        items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("Error in getMyList:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve wishlist",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc Remove a product from the user's wishlist
 * @route DELETE /api/mylist/remove/:productId
 * @access Private
 */
export const removeFromMyList = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const deletedItem = await MyListModel.findOneAndDelete({
      userId,
      productId
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Product not found in your wishlist"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      data: deletedItem
    });

  } catch (error) {
    console.error("Error in removeFromMyList:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc Clear the user's wishlist
 * @route DELETE /api/mylist/clear
 * @access Private
 */
export const clearWishlist = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const result = await MyListModel.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
      data: {
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error("Error in clearWishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear wishlist",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc Check if a product is in the user's wishlist
 * @route GET /api/mylist/check/:productId
 * @access Private
 */
export const checkProductInWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const exists = await MyListModel.exists({ userId, productId });

    return res.status(200).json({
      success: true,
      data: {
        inWishlist: !!exists
      }
    });

  } catch (error) {
    console.error("Error in checkProductInWishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check wishlist status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc Get the count of products in the user's wishlist
 * @route GET /api/mylist/count
 * @access Private
 */
export const getWishlistCount = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const count = await MyListModel.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      data: {
        count
      }
    });

  } catch (error) {
    console.error("Error in getWishlistCount:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get wishlist count",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc Get aggregated statistics about the user's wishlist
 * @route GET /api/mylist/stats
 * @access Private
 */
export const getWishlistStats = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const stats = await MyListModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: '$price' },
          totalSavings: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$oldPrice', null] },
                  { $gt: ['$oldPrice', '$price'] }
                ]},
                { $subtract: ['$oldPrice', '$price'] },
                0
              ]
            }
          },
          avgPrice: { $avg: '$price' },
          maxPrice: { $max: '$price' },
          minPrice: { $min: '$price' },
          itemsOnSale: {
            $sum: { $cond: [{ $gt: ['$discount', 0] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : {
      totalItems: 0,
      totalValue: 0,
      totalSavings: 0,
      avgPrice: 0,
      maxPrice: 0,
      minPrice: 0,
      itemsOnSale: 0
    };

    // Remove _id field from result
    delete result._id;

    return res.status(200).json({
      success: true,
      message: "Wishlist stats retrieved successfully",
      data: result
    });

  } catch (error) {
    console.error("Error in getWishlistStats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get wishlist stats",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc Sync wishlist products with latest product data
 * @route POST /api/mylist/sync
 * @access Private
 */
export const syncWishlistProducts = async (req, res) => {
  try {
    const userId = req.userId; // From authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const wishlistItems = await MyListModel.find({ userId });
    
    const results = {
      success: 0,
      failed: 0,
      updated: [],
      errors: []
    };

    for (const item of wishlistItems) {
      try {
        const product = await ProductModel.findById(item.productId);
        
        if (!product) {
          results.failed++;
          results.errors.push({
            productId: item.productId,
            productTitle: item.productTitle,
            error: "Product not found"
          });
          continue;
        }

        const productImageUrl = product.images?.[0]?.url || item.productImage;

        // Check if there are any changes
        const hasChanges = 
          item.productTitle !== product.name ||
          item.price !== product.price ||
          item.oldPrice !== product.oldPrice ||
          item.discount !== product.discount ||
          item.rating !== product.rating ||
          item.productImage !== productImageUrl;

        if (hasChanges) {
          item.productTitle = product.name;
          item.productImage = productImageUrl;
          item.price = product.price;
          item.oldPrice = product.oldPrice || null;
          item.discount = product.discount || 0;
          item.rating = product.rating || 0;
          
          await item.save();
          
          results.updated.push({
            productId: item.productId,
            productTitle: item.productTitle
          });
        }
        
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          productId: item.productId,
          productTitle: item.productTitle,
          error: error.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Wishlist sync completed",
      data: results
    });

  } catch (error) {
    console.error("Error in syncWishlistProducts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync wishlist products",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};