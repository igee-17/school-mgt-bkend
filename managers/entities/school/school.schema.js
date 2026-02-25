module.exports = {
    createSchool: [
        { model: 'name',    required: true },
        { model: 'address', required: false },
        { model: 'phone',   required: false },
        { model: 'email',   required: false },
    ],
    updateSchool: [
        { model: 'name',    required: false },
        { model: 'address', required: false },
        { model: 'phone',   required: false },
        { model: 'email',   required: false },
    ],
    createSchoolAdmin: [
        { model: 'username', required: true },
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
    listSchoolAdmins: [
        { path: 'schoolId', type: 'string', length: { min: 1, max: 50 }, required: true },
    ],
}
