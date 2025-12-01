import mongoose from "mongoose";

const myListSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  productTitle: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    maxlength: [500, 'Product title cannot exceed 500 characters'],
  },
  productImage: {
    type: String,
    required: [true, 'Product image is required'],
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
    default: 0,
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  oldPrice: {
    type: Number,
    default: null,
    min: [0, 'Old price cannot be negative'],
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters'],
  },
  discount: {
    type: Number,
    required: [true, 'Discount is required'],
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100'],
  },

}, { timestamps: true });

myListSchema.index({ userId: 1, productId: 1 }, { unique: true });
myListSchema.index({ userId: 1 });

const MyListModel = mongoose.model('MyList', myListSchema);

export default MyListModel;