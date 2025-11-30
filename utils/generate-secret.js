import crypto from 'crypto';

// Tạo JWT_SECRET cho general purpose (256 bit → 32 bytes → 64 ký tự hex)
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('JWT_SECRET:', jwtSecret);

// Tạo secret cho access token (HS512 cần 512 bit → 64 bytes → 128 ký tự hex)
const accessTokenSecret = crypto.randomBytes(64).toString('hex');
console.log('ACCESS_TOKEN_SECRET:', accessTokenSecret);

// Tạo secret cho refresh token (càng dài càng tốt)
const refreshTokenSecret = crypto.randomBytes(128).toString('hex');
console.log('REFRESH_TOKEN_SECRET:', refreshTokenSecret);

// Tạo SECRET_KEY_REFRESH_TOKEN (tương thích với tên biến hiện tại)
console.log('\n=== Copy vào file .env ===\n');
console.log(`JWT_SECRET="${jwtSecret}"`);
console.log(`ACCESS_TOKEN_SECRET="${accessTokenSecret}"`);
console.log(`SECRET_KEY_REFRESH_TOKEN="${refreshTokenSecret}"`);