module.exports = {
    createUser: [
        { model: 'username', required: true },
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
    loginUser: [
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
    createSuperAdmin: [
        { model: 'username', required: true },
        { model: 'email',    required: true },
        { model: 'password', required: true },
    ],
}
