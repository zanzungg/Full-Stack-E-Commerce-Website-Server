import { Router } from "express";
import auth from "../middlewares/auth.js";
import { 
  clearCart,
  createCartItem,
  decrementCartQuantity,
  deleteCartItem,
  deleteCartItemsBatch,
  getCartItems,
  incrementCartQuantity,
  moveToCart,
  saveForLater,
  updateCartItemQuantity
} from "../controllers/cart.controller.js";

const cartRouter = Router();

// CRUD Operations
cartRouter.post("/create", auth, createCartItem);
cartRouter.get("/", auth, getCartItems);
cartRouter.put('/update-quantity/:id', auth, updateCartItemQuantity);
cartRouter.delete('/clear', auth, clearCart);
cartRouter.delete('/batch', auth, deleteCartItemsBatch);
cartRouter.delete('/:id', auth, deleteCartItem);

// Quantity operations
cartRouter.patch('/:id/increment', auth, incrementCartQuantity);
cartRouter.patch('/:id/decrement', auth, decrementCartQuantity);

// Save for later operations
cartRouter.patch('/:id/save-for-later', auth, saveForLater);
cartRouter.patch('/:id/move-to-cart', auth, moveToCart);

export default cartRouter;