module.exports = {
    createStudent: [
        { model: 'name',     required: true },
        { model: 'email',    required: true },
        { model: 'age',      required: false },
        { model: 'username', required: true },
        { model: 'password', required: true },
    ],
    updateStudent: [
        { model: 'name',     required: false },
        { model: 'age',      required: false },
    ],
    transferStudent: [
        { path: 'studentId',         type: 'string', length: { min: 1, max: 50 }, required: true },
        { path: 'targetSchoolId',    type: 'string', length: { min: 1, max: 50 }, required: true },
        { path: 'targetClassroomId', type: 'string', length: { min: 1, max: 50 }, required: false },
    ],
    changePassword: [
        { path: 'currentPassword', type: 'string', length: { min: 8, max: 100 }, required: true },
        { path: 'newPassword',     type: 'string', length: { min: 8, max: 100 }, required: true },
    ],
}
