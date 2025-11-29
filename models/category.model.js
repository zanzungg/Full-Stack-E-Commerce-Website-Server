import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    trim: true,
    unique: true,
    minLength: [2, "Category name must be at least 2 characters long"],
    maxLength: [100, "Category name must be at most 100 characters long"],
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxLength: [500, "Category description must be at most 500 characters long"],
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
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active"
  },
  parentCatName: {
    type: String,
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);

export default Category;