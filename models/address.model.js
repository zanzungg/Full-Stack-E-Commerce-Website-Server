import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    address_line: {
        type: String,
        default: '',
    },
    city: {
        type: String,
        default: '',
    },
    state: {
        type: String,
        default: '',
    },
    pincode: {
        type: String
    },
    country: {
        type: String,
    },
    mobile: {
        type: String,
        default: '',
    },
    status: {
        type: Boolean,
        default: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        default: '',
        ref: 'User',
    }
}, { timestamps: true }
);

const AddressModel = mongoose.model('Address', addressSchema);

export default AddressModel;
