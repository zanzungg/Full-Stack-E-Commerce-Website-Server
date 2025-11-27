import jwt from 'jsonwebtoken';

const generateAccessToken = (user) => {
    try {
        return jwt.sign(
            { 
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            process.env.SECRET_KEY_ACCESS_TOKEN,
            { expiresIn: '1h' }
        );
    } catch (error) {
        throw new Error(`Failed to generate access token: ${error.message}`);
    }
};

export default generateAccessToken;