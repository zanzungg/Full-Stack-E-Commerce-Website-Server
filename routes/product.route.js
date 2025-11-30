import { Router } from "express";
import { 
  createProduct, 
  getAllProducts, 
  getFeaturedProducts, 
  getProductById, 
  getProductsByCategory, 
  getProductsByCatId, 
  getProductsBySubCatId, 
  getProductsByThirdSubCatId, 
  uploadImages 
} from "../controllers/product.controller.js";
import auth from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";

const productRouter = Router();

// Create product with images
productRouter.post("/create", auth, upload.array("images"), createProduct);

// Upload additional images to existing product
productRouter.post("/upload-images", auth, upload.array("images"), uploadImages);

// Get all products with filters and pagination
productRouter.get("/", getAllProducts);

// IMPORTANT: Specific routes MUST come before dynamic routes
// Get featured products - MUST be before /:id
productRouter.get("/featured", getFeaturedProducts);

// Get products by category
productRouter.get("/category/:categoryId", getProductsByCategory);

// Get products by catId
productRouter.get("/catId/:catId", getProductsByCatId);

// Get products by subCatId
productRouter.get("/subCatId/:subCatId", getProductsBySubCatId);

// Get products by thirdSubCatId
productRouter.get("/thirdSubCatId/:thirdSubCatId", getProductsByThirdSubCatId);


// Get single product by ID
productRouter.get("/:id", getProductById);

export default productRouter;