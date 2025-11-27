import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tạo đường dẫn uploads từ root project
const uploadDir = path.join(__dirname, '../uploads');

// Tạo thư mục uploads nếu chưa tồn tại
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Sanitize filename - loại bỏ ký tự đặc biệt
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const ext = path.extname(originalName);
        const nameWithoutExt = path.basename(originalName, ext);
        
        // Tạo tên file unique: name_timestamp_random.ext
        const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
        const filename = `${nameWithoutExt}_${uniqueSuffix}${ext}`;
        
        cb(null, filename);
    }
});

// File filter - validate file type
const fileFilter = (req, file, cb) => {
    // Allowed image types
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ];
    
    const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP, and SVG are allowed.'), false);
    }
    
    // Check extension
    if (!allowedExtensions.test(file.originalname)) {
        return cb(new Error('Invalid file extension.'), false);
    }
    
    cb(null, true);
};

// Cấu hình multer với options đầy đủ
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 10, // Tối đa 10 files
        fields: 20, // Tối đa 20 non-file fields
        parts: 30 // Tối đa 30 parts (files + fields)
    },
    fileFilter: fileFilter
});

// Middleware xử lý lỗi multer
export const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    message: 'File size too large. Maximum size is 5MB.',
                    error: true,
                    success: false
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    message: 'Too many files. Maximum is 10 files.',
                    error: true,
                    success: false
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    message: 'Unexpected field name in file upload.',
                    error: true,
                    success: false
                });
            case 'LIMIT_PART_COUNT':
                return res.status(400).json({
                    message: 'Too many parts in the request.',
                    error: true,
                    success: false
                });
            case 'LIMIT_FIELD_KEY':
                return res.status(400).json({
                    message: 'Field name too long.',
                    error: true,
                    success: false
                });
            case 'LIMIT_FIELD_VALUE':
                return res.status(400).json({
                    message: 'Field value too long.',
                    error: true,
                    success: false
                });
            case 'LIMIT_FIELD_COUNT':
                return res.status(400).json({
                    message: 'Too many fields.',
                    error: true,
                    success: false
                });
            default:
                return res.status(400).json({
                    message: error.message || 'File upload error.',
                    error: true,
                    success: false
                });
        }
    }
    
    // Lỗi từ fileFilter hoặc lỗi khác
    if (error) {
        return res.status(400).json({
            message: error.message || 'File upload error.',
            error: true,
            success: false
        });
    }
    
    next();
};

export default upload;