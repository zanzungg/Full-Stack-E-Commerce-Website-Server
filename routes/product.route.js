import { Router } from "express";
import { createProduct, uploadImages } from "../controllers/product.controller.js";
import auth from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";

const productRouter = Router();

// Create product with images
productRouter.post("/create", auth, upload.array("images"), createProduct);

// Upload additional images to existing product
productRouter.post("/upload-images", auth, upload.array("images"), uploadImages);

export default productRouter;