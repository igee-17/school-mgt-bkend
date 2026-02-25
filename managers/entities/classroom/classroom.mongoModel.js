const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true,
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 1000,
    },
    resources: {
        type: String,
        trim: true,
        maxlength: 500,
    },
}, { timestamps: true });

classroomSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Classroom', classroomSchema);
