import { Router } from "express";
import { 
    loginUserController,
    logoutUserController,
    registerUserController, 
    uploadAvatarController, 
    verifyEmailController,
    getUserProfileController,
    updateUserProfileController,
    forgotPasswordController,
    verifyResetCodeController,
    resetPasswordController,
    refreshTokenController,
    changePasswordController
} from "../controllers/user.controller.js";
import { deleteImageController } from "../controllers/image.controller.js";
import auth from "../middlewares/auth.js";
import upload, { handleMulterError } from "../middlewares/multer.js";

const userRouter = Router();

// Authentication routes
userRouter.post("/register", registerUserController);
userRouter.post("/verify-email", verifyEmailController);
userRouter.post("/login", loginUserController);
userRouter.post("/logout", auth, logoutUserController);
userRouter.post("/refresh-token", refreshTokenController);

// Password reset routes
userRouter.post("/forgot-password", forgotPasswordController);
userRouter.post("/verify-reset-code", verifyResetCodeController);
userRouter.post("/reset-password", resetPasswordController);
userRouter.post("/change-password", auth, changePasswordController);

// Profile routes
userRouter.post("/profile", auth, getUserProfileController);
userRouter.put("/profile", auth, updateUserProfileController);

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