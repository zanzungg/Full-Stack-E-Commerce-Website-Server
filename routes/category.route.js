import { Router } from "express";
import { 
    createCategory,
    uploadImages, 
    deleteCategoryImage,
    getCategories,
    getCategoryById,
    getCategoryBySlug,
    getCategoryTree,
    updateCategory,
    deleteCategory
} from "../controllers/category.controller.js";
import upload from "../middlewares/multer.js";
import auth from "../middlewares/auth.js";

const categoryRouter = Router();

// Create category with images
categoryRouter.post("/create", auth, upload.array("images"), createCategory);

// Upload additional images to existing category
categoryRouter.post("/upload-images", auth, upload.array("images"), uploadImages);

// Delete category image
categoryRouter.delete("/delete-image", auth, deleteCategoryImage);

// Get all categories with filters and pagination
categoryRouter.get("/", getCategories);

// Get category tree (hierarchical)
categoryRouter.get("/tree", getCategoryTree);

// Get single category by ID
categoryRouter.get("/:categoryId", getCategoryById);

// Get category by slug
categoryRouter.get("/slug/:slug", getCategoryBySlug);

// Update category
categoryRouter.put("/:categoryId", auth, updateCategory);

// Delete category
categoryRouter.delete("/:categoryId", auth, deleteCategory);

export default categoryRouter;