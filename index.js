import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import connectDB from './config/connectDB.js';
import userRouter from './routes/user.route.js';

const app = express();

// Cấu hình CORS
app.use(cors({
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(helmet({
    crossOriginResourcePolicy: false
}));

app.get('/', (req, res) => {
    res.json({ 
        message: 'Server is running on port ' + process.env.PORT 
    });
});

app.use('/api/users', userRouter);

connectDB().then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
});
