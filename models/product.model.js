import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
    index: true,
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  images: [
    {
      url: {
        type: String,
        required: true
      },
      public_id: {
        type: String,
        required: true
      }
    }
  ],
  brand: {
    type: String,
    trim: true,
    default: '',
    maxlength: [100, 'Brand name cannot exceed 100 characters'],
    index: true,
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    default: 0,
    index: true,
  },
  oldPrice: {
    type: Number,
    min: [0, 'Old price cannot be negative'],
    default: 0,
  },
  catName: {
    type: String,
    trim: true,
    default: '',
    maxlength: [100, 'Category name cannot exceed 100 characters'],
    index: true,
  },
  catId: {
    type: String,
    trim: true,
    default: '',
    index: true,
  },
  subCatId: {
    type: String,
    trim: true,
    default: '',
    index: true,
  },
  subCat: {
    type: String,
    trim: true,
    default: '',
    maxlength: [100, 'Subcategory name cannot exceed 100 characters'],
  },
  thirdSubCat: {
    type: String,
    trim: true,
    default: '',
    maxlength: [100, 'Third subcategory name cannot exceed 100 characters'],
  },
  thirdSubCatId: {
    type: String,
    trim: true,
    default: '',
    index: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required'],
    index: true,
  },
  countInStock: {
    type: Number,
    required: [true, 'Stock count is required'],
    min: [0, 'Stock count cannot be negative'],
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be greater than 5'],
    index: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  discount: {
    type: Number,
    required: [true, 'Discount is required'],
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0,
  },
  productRam: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(ram => ram && ram.trim().length > 0);
      },
      message: 'RAM values cannot be empty'
    }
  },
  size: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(size => size && size.trim().length > 0);
      },
      message: 'Size values cannot be empty'
    }
  },
  productWeight: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(weight => weight && weight.trim().length > 0);
      },
      message: 'Weight values cannot be empty'
    }
  },
  location: [
    {
      value: {
        type: String,
        required: [true, 'Location value is required'],
        trim: true,
      },
      label: {
        type: String,
        required: [true, 'Location label is required'],
        trim: true,
      },
      _id: false,
    }
  ],
}, {
  timestamps: true,
});

// Indexes for optimal query performance
productSchema.index({ name: 'text', description: 'text' }); // Full-text search
productSchema.index({ price: 1, rating: -1 }); // Compound index for sorting
productSchema.index({ catId: 1, subCatId: 1, price: 1 }); // Category filtering
productSchema.index({ isFeatured: 1, dateCreated: -1 }); // Featured products
productSchema.index({ brand: 1, price: 1 }); // Brand filtering
productSchema.index({ countInStock: 1 }); // Stock availability queries
productSchema.index({ createdAt: -1 }); // Recent products

const ProductModel = mongoose.model('Product', productSchema);

export default ProductModel;