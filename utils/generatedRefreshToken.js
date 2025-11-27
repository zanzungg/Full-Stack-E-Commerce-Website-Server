import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model.js';

const generateRefreshToken = async (user) => {
    try {
        const token = jwt.sign(
            { 
                email: user.email, 
                id: user._id, 
                role: user.role 
            },
            process.env.SECRET_KEY_REFRESH_TOKEN,
            { expiresIn: '7d' }
        );

        await UserModel.findByIdAndUpdate(
            user._id,
            { refresh_token: token },
        );

        return token;
    } catch (error) {
        throw new Error(`Failed to generate refresh token: ${error.message}`);
    }
}

export default generateRefreshToken;