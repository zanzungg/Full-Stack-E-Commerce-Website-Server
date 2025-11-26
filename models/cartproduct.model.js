import mongoose from "mongoose";

const cartProductSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    },
    quantity: {
        type: Number,
        default: 1,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, { timestamps: true }
);

const CartProductModel = mongoose.model('CartProduct', cartProductSchema);

export default CartProductModel;