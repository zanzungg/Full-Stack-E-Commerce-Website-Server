import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Provide a name'],
    },
    email: {
        type: String,
        required: [true, 'Provide an email'],
        unique: true,
    },
    password: {
        type: String,
        required: [true, 'Provide a password'],
    },
    avatar: {
        type: String,
        default: '',
    },
    mobile: {
        type: String,
        default: '',
    },
    verify_email: {
        type: Boolean,
        default: false,
    },
    last_login_date: {
        type: Date,
        default: null,
    },
    status:{
        type: String,
        enum: ['Active', 'Inactive', 'Suspended'],
        default: 'Active',
    },
    address_details: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Address'
        }
    ],
    shopping_cart: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'cartProduct'
        }
    ],
    order_history: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }
    ],
    forgot_password_otp: {
        type: String,
        default: null,
    },
    forgot_password_expiry: {
        type: Date,
        default: null,
    },
    role: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User',
    }
},
    { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default UserModel;