import { Router } from "express";
import { 
    loginUserController,
    logoutUserController,
    registerUserController, 
    uploadAvatarController, 
    verifyEmailController 
} from "../controllers/user.controller.js";
import { deleteImageController } from "../controllers/image.controller.js";
import auth from "../middlewares/auth.js";
import upload, { handleMulterError } from "../middlewares/multer.js";

const userRouter = Router();

userRouter.post("/register", registerUserController);
userRouter.post("/verify-email", verifyEmailController);
userRouter.post("/login", loginUserController);
userRouter.post("/logout", auth, logoutUserController);

// Upload avatar - single file
userRouter.put("/avatar", 
    auth, 
    upload.single('avatar'),
    handleMulterError,
    uploadAvatarController
);

// Delete image
userRouter.delete("/images",
    auth,
    deleteImageController
);

export default userRouter;