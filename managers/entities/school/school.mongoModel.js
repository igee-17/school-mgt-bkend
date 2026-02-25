const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100,
        unique: true,
    },
    address: {
        type: String,
        trim: true,
        maxlength: 300,
    },
    phone: {
        type: String,
        trim: true,
        maxlength: 20,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 100,
    },
}, { timestamps: true });

module.exports = mongoose.model('School', schoolSchema);
