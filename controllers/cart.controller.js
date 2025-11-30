import mongoose from "mongoose";
import CartProductModel from "../models/cartproduct.model.js";
import UserModel from "../models/user.model.js";
import ProductModel from "../models/product.model.js";

/**
 * Add a product to user's shopping cart
 * @route POST /api/cart/add
 * @access Private
 */
export const createCartItem = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { productId, variant = null } = req.body;
    const quantity = Number(req.body.quantity) || 1;

    // Validate input
    if (!productId) {
      return res.status(400).json({
        message: 'Product ID is required',
        error: true,
        success: false
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'Invalid Product ID format',
        error: true,
        success: false
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({
        message: 'Quantity must be an integer between 1 and 100',
        error: true,
        success: false
      });
    }

    // Check if product exists and is available
    const product = await ProductModel.findById(productId).session(session);
    
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Product not found',
        error: true,
        success: false
      });
    }

    // Check stock availability
    if (product.countInStock < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Only ${product.countInStock} items available in stock`,
        error: true,
        success: false,
        availableStock: product.countInStock
      });
    }

    // Check if product is out of stock
    if (product.countInStock === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Product is out of stock',
        error: true,
        success: false
      });
    }

    // Check if item already exists in cart
    const existingCartItem = await CartProductModel.findOne({ 
      userId, 
      productId 
    }).session(session);

    if (existingCartItem) {
      // Update quantity if item exists
      const newQuantity = existingCartItem.quantity + quantity;
      
      if (newQuantity > 100) {
        await session.abortTransaction();
        return res.status(400).json({
          message: 'Total quantity cannot exceed 100',
          error: true,
          success: false,
          currentQuantity: existingCartItem.quantity
        });
      }

      if (newQuantity > product.countInStock) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Only ${product.countInStock} items available. You already have ${existingCartItem.quantity} in cart`,
          error: true,
          success: false,
          availableStock: product.countInStock,
          currentQuantity: existingCartItem.quantity
        });
      }

      existingCartItem.quantity = newQuantity;
      existingCartItem.priceAtAdd = product.price;
      existingCartItem.variant = variant;
      existingCartItem.status = 'active';
      
      await existingCartItem.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        message: 'Cart item quantity updated successfully',
        data: existingCartItem,
        error: false,
        success: true
      });
    }

    // Create new cart item
    const cartItem = new CartProductModel({
      quantity,
      productId,
      userId,
      priceAtAdd: product.price,
      variant,
      status: 'active'
    });

    const savedCartItem = await cartItem.save({ session });

    // Update user's shopping cart array
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $addToSet: { shopping_cart: productId }
      },
      { session }
    );

    await session.commitTransaction();

    // Populate product details for response
    const populatedCartItem = await CartProductModel.findById(savedCartItem._id)
      .populate('productId', 'name price images brand countInStock discount oldPrice')
      .lean();

    return res.status(201).json({
      message: 'Item added to cart successfully',
      data: populatedCartItem,
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    
    console.error('Error in createCartItem:', error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Item already exists in cart',
        error: true,
        success: false
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message,
        error: true,
        success: false
      });
    }

    return res.status(500).json({
      message: 'Failed to add item to cart. Please try again later',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
}

/**
 * Get all cart items for the authenticated user
 * @route GET /api/cart
 * @access Private
 */
export const getCartItems = async (req, res) => {
  try {
    const userId = req.userId;
    const { status = 'active' } = req.query;

    // Validate status if provided
    const validStatuses = ['active', 'saved_for_later', 'out_of_stock'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        error: true,
        success: false
      });
    }

    // Build query
    const query = { userId };
    if (status) {
      query.status = status;
    }

    // Fetch cart items with populated product details
    const cartItems = await CartProductModel.find(query)
      .populate({
        path: 'productId',
        select: 'name price oldPrice images brand countInStock discount rating isFeatured',
        match: { _id: { $exists: true } } // Only include if product still exists
      })
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    // Filter out items where product has been deleted
    const validCartItems = cartItems.filter(item => item.productId !== null);

    // Calculate cart summary
    const summary = {
      totalItems: validCartItems.length,
      totalQuantity: validCartItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: validCartItems.reduce((sum, item) => {
        return sum + (item.priceAtAdd * item.quantity);
      }, 0),
      estimatedTotal: validCartItems.reduce((sum, item) => {
        // Use current price for estimation
        const currentPrice = item.productId?.price || item.priceAtAdd;
        return sum + (currentPrice * item.quantity);
      }, 0)
    };

    // Check for stock issues
    const stockIssues = validCartItems.filter(item => {
      const product = item.productId;
      return product && (
        product.countInStock === 0 || 
        product.countInStock < item.quantity
      );
    }).map(item => ({
      cartItemId: item._id,
      productId: item.productId._id,
      productName: item.productId.name,
      requestedQuantity: item.quantity,
      availableStock: item.productId.countInStock,
      message: item.productId.countInStock === 0 
        ? 'Out of stock' 
        : `Only ${item.productId.countInStock} available`
    }));

    // Check for price changes
    const priceChanges = validCartItems.filter(item => {
      const product = item.productId;
      return product && product.price !== item.priceAtAdd;
    }).map(item => ({
      cartItemId: item._id,
      productId: item.productId._id,
      productName: item.productId.name,
      oldPrice: item.priceAtAdd,
      newPrice: item.productId.price,
      difference: item.productId.price - item.priceAtAdd,
      percentChange: ((item.productId.price - item.priceAtAdd) / item.priceAtAdd * 100).toFixed(2)
    }));

    return res.status(200).json({
      message: 'Cart items retrieved successfully',
      data: {
        items: validCartItems,
        summary,
        alerts: {
          stockIssues: stockIssues.length > 0 ? stockIssues : null,
          priceChanges: priceChanges.length > 0 ? priceChanges : null
        }
      },
      error: false,
      success: true
    });

  } catch (error) {
    console.error('Error in getCartItems:', error);

    return res.status(500).json({
      message: 'Failed to retrieve cart items',
      error: true,
      success: false
    });
  }
};

/**
 * Update cart item quantity (set exact value, not add)
 * @route PUT /api/cart/update-quantity/:id
 * @route PATCH /api/cart/:id/quantity
 * @access Private
 */
export const updateCartItemQuantity = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { id } = req.params;
    const quantity = Number(req.body.quantity);

    // Validate cart item ID
    if (!id) {
      return res.status(400).json({
        message: 'Cart Item ID is required',
        error: true,
        success: false
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false
      });
    }

    // Validate quantity
    if (!quantity) {
      return res.status(400).json({
        message: 'Quantity is required',
        error: true,
        success: false
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({
        message: 'Quantity must be an integer between 1 and 100',
        error: true,
        success: false
      });
    }

    // Find cart item and verify ownership
    const cartItem = await CartProductModel.findOne({
      _id: id,
      userId
    }).session(session);

    if (!cartItem) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Cart item not found or you do not have permission to update it',
        error: true,
        success: false
      });
    }

    // Check if product still exists
    const product = await ProductModel.findById(cartItem.productId).session(session);
    
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Product no longer exists',
        error: true,
        success: false
      });
    }

    // Check if quantity is the same (no need to update)
    if (cartItem.quantity === quantity) {
      await session.abortTransaction();
      return res.status(200).json({
        message: 'Quantity is already set to this value',
        data: cartItem,
        error: false,
        success: true
      });
    }

    // Check stock availability
    if (product.countInStock === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Product is out of stock',
        error: true,
        success: false,
        availableStock: 0
      });
    }

    if (quantity > product.countInStock) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Only ${product.countInStock} items available in stock`,
        error: true,
        success: false,
        availableStock: product.countInStock,
        requestedQuantity: quantity
      });
    }

    // Store old quantity for comparison
    const oldQuantity = cartItem.quantity;

    // Update cart item quantity (SET, not ADD)
    cartItem.quantity = quantity;
    cartItem.priceAtAdd = product.price; // Update to current price
    cartItem.status = 'active'; // Ensure status is active
    
    await cartItem.save({ session });
    await session.commitTransaction();

    // Populate product details for response
    const populatedCartItem = await CartProductModel.findById(cartItem._id)
      .populate('productId', 'name price images brand countInStock discount oldPrice rating')
      .lean();

    return res.status(200).json({
      message: 'Cart quantity updated successfully',
      data: {
        cartItem: populatedCartItem,
        changes: {
          oldQuantity,
          newQuantity: quantity,
          quantityDifference: quantity - oldQuantity,
          oldTotal: oldQuantity * product.price,
          newTotal: quantity * product.price,
          totalDifference: (quantity - oldQuantity) * product.price
        }
      },
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    
    console.error('Error in updateCartItemQuantity:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: error.message,
        error: true,
        success: false
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid ID format',
        error: true,
        success: false
      });
    }

    return res.status(500).json({
      message: 'Failed to update cart quantity',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
};

/**
 * Increment cart item quantity by 1
 * @route PATCH /api/cart/:id/increment
 * @access Private
 */
export const incrementCartQuantity = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false
      });
    }

    const cartItem = await CartProductModel.findOne({
      _id: id,
      userId
    }).session(session);

    if (!cartItem) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Cart item not found',
        error: true,
        success: false
      });
    }

    // Check max quantity limit
    if (cartItem.quantity >= 100) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Maximum quantity limit reached (100)',
        error: true,
        success: false,
        currentQuantity: cartItem.quantity
      });
    }

    // Check product stock
    const product = await ProductModel.findById(cartItem.productId).session(session);
    
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Product not found',
        error: true,
        success: false
      });
    }

    if (cartItem.quantity + 1 > product.countInStock) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Maximum available stock reached (${product.countInStock})`,
        error: true,
        success: false,
        availableStock: product.countInStock,
        currentQuantity: cartItem.quantity
      });
    }

    cartItem.quantity += 1;
    await cartItem.save({ session });
    await session.commitTransaction();

    const populatedCartItem = await CartProductModel.findById(cartItem._id)
      .populate('productId', 'name price images brand countInStock')
      .lean();

    return res.status(200).json({
      message: 'Quantity incremented successfully',
      data: populatedCartItem,
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in incrementCartQuantity:', error);

    return res.status(500).json({
      message: 'Failed to increment quantity',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
};

/**
 * Decrement cart item quantity by 1
 * @route PATCH /api/cart/:id/decrement
 * @access Private
 */
export const decrementCartQuantity = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false
      });
    }

    const cartItem = await CartProductModel.findOne({
      _id: id,
      userId
    }).session(session);

    if (!cartItem) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Cart item not found',
        error: true,
        success: false
      });
    }

    // Check min quantity limit
    if (cartItem.quantity <= 1) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Quantity cannot be less than 1. Please remove item instead.',
        error: true,
        success: false,
        currentQuantity: cartItem.quantity,
        suggestion: 'Use DELETE /api/cart/:id to remove this item'
      });
    }

    cartItem.quantity -= 1;
    await cartItem.save({ session });
    await session.commitTransaction();

    const populatedCartItem = await CartProductModel.findById(cartItem._id)
      .populate('productId', 'name price images brand countInStock')
      .lean();

    return res.status(200).json({
      message: 'Quantity decremented successfully',
      data: populatedCartItem,
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in decrementCartQuantity:', error);

    return res.status(500).json({
      message: 'Failed to decrement quantity',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
};

/**
 * Delete a single cart item
 * @route DELETE /api/cart/:id
 * @access Private
 */
export const deleteCartItem = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { id } = req.params;

    // Validate cart item ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false
      });
    }

    // Find and verify ownership
    const cartItem = await CartProductModel.findOne({
      _id: id,
      userId
    }).session(session);

    if (!cartItem) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'Cart item not found or you do not have permission to delete it',
        error: true,
        success: false
      });
    }

    // Store info before deletion for response
    const deletedInfo = {
      cartItemId: cartItem._id,
      productId: cartItem.productId,
      quantity: cartItem.quantity,
      priceAtAdd: cartItem.priceAtAdd,
      totalValue: cartItem.quantity * cartItem.priceAtAdd
    };

    // Delete cart item
    await CartProductModel.deleteOne({ _id: id, userId }).session(session);

    // Remove product from user's shopping_cart array
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $pull: { shopping_cart: cartItem.productId }
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      message: 'Cart item deleted successfully',
      data: {
        deleted: deletedInfo
      },
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in deleteCartItem:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid ID format',
        error: true,
        success: false
      });
    }

    return res.status(500).json({
      message: 'Failed to delete cart item',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
};

/**
 * Clear all cart items for user
 * @route DELETE /api/cart/clear
 * @access Private
 */
export const clearCart = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { status } = req.query; // Optional: clear only specific status items

    // Build delete query
    const deleteQuery = { userId };
    if (status) {
      const validStatuses = ['active', 'saved_for_later', 'out_of_stock'];
      if (!validStatuses.includes(status)) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          error: true,
          success: false
        });
      }
      deleteQuery.status = status;
    }

    // Get items before deletion for summary
    const itemsToDelete = await CartProductModel.find(deleteQuery)
      .session(session)
      .lean();

    if (itemsToDelete.length === 0) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'No cart items found to clear',
        error: true,
        success: false
      });
    }

    // Calculate summary
    const summary = {
      itemsDeleted: itemsToDelete.length,
      totalQuantity: itemsToDelete.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: itemsToDelete.reduce((sum, item) => sum + (item.quantity * item.priceAtAdd), 0)
    };

    // Delete all matching cart items
    const deleteResult = await CartProductModel.deleteMany(deleteQuery).session(session);

    // Clear shopping_cart array in user document
    // Only if clearing all items (no status filter)
    if (!status) {
      await UserModel.findByIdAndUpdate(
        userId,
        {
          $set: { shopping_cart: [] }
        },
        { session }
      );
    } else {
      // Remove only deleted product IDs
      const productIds = itemsToDelete.map(item => item.productId);
      await UserModel.findByIdAndUpdate(
        userId,
        {
          $pull: { shopping_cart: { $in: productIds } }
        },
        { session }
      );
    }

    await session.commitTransaction();

    return res.status(200).json({
      message: `${status ? status.replace('_', ' ').toUpperCase() : 'All'} cart items cleared successfully`,
      data: {
        summary,
        deletedCount: deleteResult.deletedCount
      },
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in clearCart:', error);

    return res.status(500).json({
      message: 'Failed to clear cart',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
};

/**
 * Delete multiple cart items by IDs
 * @route DELETE /api/cart/batch
 * @access Private
 */
export const deleteCartItemsBatch = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const userId = req.userId;
    const { cartItemIds } = req.body;

    // Validate input
    if (!cartItemIds || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      return res.status(400).json({
        message: 'cartItemIds must be a non-empty array',
        error: true,
        success: false
      });
    }

    // Validate all IDs
    const invalidIds = cartItemIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false,
        invalidIds
      });
    }

    // Limit batch size to prevent abuse
    if (cartItemIds.length > 50) {
      return res.status(400).json({
        message: 'Cannot delete more than 50 items at once',
        error: true,
        success: false
      });
    }

    // Find items and verify ownership
    const cartItems = await CartProductModel.find({
      _id: { $in: cartItemIds },
      userId
    }).session(session);

    if (cartItems.length === 0) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'No cart items found or you do not have permission to delete them',
        error: true,
        success: false
      });
    }

    // Calculate summary
    const summary = {
      requestedCount: cartItemIds.length,
      foundCount: cartItems.length,
      notFoundCount: cartItemIds.length - cartItems.length,
      totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: cartItems.reduce((sum, item) => sum + (item.quantity * item.priceAtAdd), 0)
    };

    // Get product IDs for user update
    const productIds = cartItems.map(item => item.productId);

    // Delete cart items
    const deleteResult = await CartProductModel.deleteMany({
      _id: { $in: cartItemIds },
      userId
    }).session(session);

    // Remove products from user's shopping_cart array
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $pull: { shopping_cart: { $in: productIds } }
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      message: `${deleteResult.deletedCount} cart item(s) deleted successfully`,
      data: {
        summary,
        deletedCount: deleteResult.deletedCount
      },
      error: false,
      success: true
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in deleteCartItemsBatch:', error);

    return res.status(500).json({
      message: 'Failed to delete cart items',
      error: true,
      success: false
    });
  } finally {
    session.endSession();
  }
};

/**
 * Move cart item to "Saved for later"
 * @route PATCH /api/cart/:id/save-for-later
 * @access Private
 */
export const saveForLater = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false
      });
    }

    const cartItem = await CartProductModel.findOne({
      _id: id,
      userId
    });

    if (!cartItem) {
      return res.status(404).json({
        message: 'Cart item not found',
        error: true,
        success: false
      });
    }

    if (cartItem.status === 'saved_for_later') {
      return res.status(400).json({
        message: 'Item is already saved for later',
        error: true,
        success: false
      });
    }

    cartItem.status = 'saved_for_later';
    await cartItem.save();

    const populatedCartItem = await CartProductModel.findById(cartItem._id)
      .populate('productId', 'name price images brand countInStock')
      .lean();

    return res.status(200).json({
      message: 'Item saved for later successfully',
      data: populatedCartItem,
      error: false,
      success: true
    });

  } catch (error) {
    console.error('Error in saveForLater:', error);

    return res.status(500).json({
      message: 'Failed to save item for later',
      error: true,
      success: false
    });
  }
};

/**
 * Move "Saved for later" item back to active cart
 * @route PATCH /api/cart/:id/move-to-cart
 * @access Private
 */
export const moveToCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid Cart Item ID format',
        error: true,
        success: false
      });
    }

    const cartItem = await CartProductModel.findOne({
      _id: id,
      userId
    }).populate('productId');

    if (!cartItem) {
      return res.status(404).json({
        message: 'Cart item not found',
        error: true,
        success: false
      });
    }

    if (cartItem.status === 'active') {
      return res.status(400).json({
        message: 'Item is already in active cart',
        error: true,
        success: false
      });
    }

    // Check stock before moving back
    if (!cartItem.productId) {
      return res.status(404).json({
        message: 'Product no longer exists',
        error: true,
        success: false
      });
    }

    if (cartItem.productId.countInStock === 0) {
      return res.status(400).json({
        message: 'Product is out of stock',
        error: true,
        success: false
      });
    }

    if (cartItem.quantity > cartItem.productId.countInStock) {
      return res.status(400).json({
        message: `Only ${cartItem.productId.countInStock} items available. Please update quantity first.`,
        error: true,
        success: false,
        availableStock: cartItem.productId.countInStock,
        currentQuantity: cartItem.quantity
      });
    }

    cartItem.status = 'active';
    cartItem.priceAtAdd = cartItem.productId.price; // Update to current price
    await cartItem.save();

    const populatedCartItem = await CartProductModel.findById(cartItem._id)
      .populate('productId', 'name price images brand countInStock')
      .lean();

    return res.status(200).json({
      message: 'Item moved to cart successfully',
      data: populatedCartItem,
      error: false,
      success: true
    });

  } catch (error) {
    console.error('Error in moveToCart:', error);

    return res.status(500).json({
      message: 'Failed to move item to cart',
      error: true,
      success: false
    });
  }
};