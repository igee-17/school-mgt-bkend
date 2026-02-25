const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

const BCRYPT_ROUNDS = 10;

module.exports = class UserManager {

    constructor({ config, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;

        this.httpExposed = [
            'loginUser',
            'createSuperAdmin',
        ];
    }

    /** public registration, creates student accounts */
    async createUser({ username, email, password }) {
        const validationError = await this.validators.user.createUser({ username, email, password });
        if (validationError) return { errors: validationError };

        const existing = await this.mongomodels.user.findOne({
            $or: [{ email: email.toLowerCase() }, { username }],
        });
        if (existing) {
            return { code: 409, error: 'username or email already in use' };
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userKey = nanoid();

        const user = await this.mongomodels.user.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'student',
            userKey,
        });

        const longToken = this.tokenManager.genLongToken({
            userId: user._id,
            userKey: user.userKey,
            role: user.role,
            schoolId: user.schoolId,
        });

        return { longToken };
    }

    /** authenticate any role */
    async loginUser({ email, password }) {
        const validationError = await this.validators.user.loginUser({ email, password });
        if (validationError) return { errors: validationError };

        const user = await this.mongomodels.user.findOne({ email: email.toLowerCase() }).lean();
        if (!user) {
            return { code: 401, error: 'invalid credentials' };
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return { code: 401, error: 'invalid credentials' };
        }

        const longToken = this.tokenManager.genLongToken({
            userId: user._id,
            userKey: user.userKey,
            role: user.role,
            schoolId: user.schoolId,
        });

        return { longToken, role: user.role };
    }

    /**
     * Bootstrap endpoint
     * Creates a superadmin account if none exists yet.
     */
    async createSuperAdmin({ adminSecret, username, email, password }) {
        if (!adminSecret || adminSecret !== this.config.dotEnv.ADMIN_SECRET) {
            return { code: 401, error: 'invalid admin secret' };
        }

        const validationError = await this.validators.user.createSuperAdmin({ username, email, password });
        if (validationError) return { errors: validationError };

        const existingSuperadmin = await this.mongomodels.user.findOne({ role: 'superadmin' });
        if (existingSuperadmin) {
            return { code: 409, error: 'a superadmin account already exists' };
        }

        const existing = await this.mongomodels.user.findOne({
            $or: [{ email: email.toLowerCase() }, { username }],
        });
        if (existing) {
            return { code: 409, error: 'username or email already in use' };
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userKey = nanoid();

        const user = await this.mongomodels.user.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'superadmin',
            userKey,
        });

        const longToken = this.tokenManager.genLongToken({
            userId: user._id,
            userKey: user.userKey,
            role: user.role,
        });

        return { longToken, role: user.role };
    }
}
