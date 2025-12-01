import { Router } from "express";
import auth from "../middlewares/auth.js";
import { 
  addToMyList,
  checkProductInWishlist,
  clearWishlist,
  getMyList,
  getWishlistCount,
  getWishlistStats,
  removeFromMyList,
  syncWishlistProducts
} from "../controllers/myList.controller.js";

const myListRouter = Router();

// CRUD Operations
myListRouter.post("/add", auth, addToMyList);
myListRouter.get("/", auth, getMyList);
myListRouter.delete("/remove/:productId", auth, removeFromMyList);
myListRouter.delete("/clear", auth, clearWishlist);

// Check & Count
myListRouter.get("/check/:productId", auth, checkProductInWishlist);
myListRouter.get("/count", auth, getWishlistCount);

// Stats
myListRouter.get("/stats", auth, getWishlistStats);

// Sync wishlist products with latest product data
myListRouter.post("/sync", auth, syncWishlistProducts);

export default myListRouter;