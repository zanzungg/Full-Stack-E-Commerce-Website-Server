import mongoose from "mongoose";

const cartProductSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required'],
    },
    quantity: {
        type: Number,
        default: 1,
        min: [1, 'Quantity cannot be less than 1'],
        max: [100, 'Quantity cannot exceed 100'],
        validate: {
            validator: Number.isInteger,
            message: 'Quantity must be an integer'
        }
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    priceAtAdd: {
        type: Number,
        required: [true, 'Price at add is required'],
        min: [0, 'Price cannot be negative']
    },
    variant: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'saved_for_later', 'out_of_stock'],
            message: '{VALUE} is not a valid status'
        },
        default: 'active',
        index: true
    },
}, { timestamps: true }
);

cartProductSchema.index({ userId: 1, productId: 1 }, { unique: true });
cartProductSchema.index({ userId: 1 });
cartProductSchema.index({ status: 1 });

const CartProductModel = mongoose.model('CartProduct', cartProductSchema);

export default CartProductModel;