import jwt from 'jsonwebtoken';

const auth = async (req, res, next) => {
    try {
        // Lấy token từ cookie hoặc header
        const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                message: 'Access token is missing',
                error: true,
                success: false
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.SECRET_KEY_ACCESS_TOKEN);

        if (!decoded) {
            return res.status(401).json({
                message: 'Invalid access token',
                error: true,
                success: false
            });
        }

        // Gán thông tin user vào request
        req.userId = decoded.id;
        req.userEmail = decoded.email;
        req.userRole = decoded.role;
        req.userName = decoded.name;

        next();
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Access token has expired',
                error: true,
                success: false
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                message: 'Invalid access token',
                error: true,
                success: false
            });
        }

        return res.status(500).json({
            message: error.message || 'Internal server error',
            error: true,
            success: false
        });
    }
};

export default auth;