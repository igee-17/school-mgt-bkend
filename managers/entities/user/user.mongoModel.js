const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: 100,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['superadmin', 'schoolAdmin', 'student'],
        default: 'student',
        index: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        default: null,
        index: true,
    },
    userKey: {
        type: String,
        required: true,
        index: true,
    },
}, { timestamps: true });

userSchema.index({ schoolId: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
