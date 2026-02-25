const bcrypt   = require('bcrypt');
const { nanoid } = require('nanoid');
const { isValidId } = require('../../_common/utils');

const BCRYPT_ROUNDS = 10;

module.exports = class SchoolManager {

    constructor({ config, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;

        this.httpExposed = [
            'createSchool',
            'get=getSchool',
            'get=listSchools',
            'put=updateSchool',
            'delete=deleteSchool',
            'createSchoolAdmin',
            'get=listSchoolAdmins',
        ];
    }

    /** POST /api/school/createSchool — superadmin only */
    async createSchool({ __longToken, __isSuperAdmin, name, address, phone, email }) {
        const validationError = await this.validators.school.createSchool({ name, address, phone, email });
        if (validationError) return { errors: validationError };

        let school;
        try {
            school = await this.mongomodels.school.create({ name, address, phone, email });
        } catch (err) {
            if (err.code === 11000) return { code: 409, error: 'a school with this name already exists' };
            throw err;
        }

        return { school };
    }

    /** GET /api/school/getSchool?id=... — superadmin only */
    async getSchool({ __longToken, __isSuperAdmin, id }) {
        if (!id) return { error: 'school id is required' };
        if (!isValidId(id)) return { error: 'invalid school id' };

        const school = await this.mongomodels.school.findById(id).lean();
        if (!school) return { code: 404, error: 'school not found' };

        return { school };
    }

    /** GET /api/school/listSchools — superadmin only */
    async listSchools({ __longToken, __isSuperAdmin, page, limit }) {
        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip     = (pageNum - 1) * limitNum;

        const [schools, total] = await Promise.all([
            this.mongomodels.school.find({}).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            this.mongomodels.school.countDocuments(),
        ]);

        return { schools, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
    }

    /** PUT /api/school/updateSchool — superadmin only */
    async updateSchool({ __longToken, __isSuperAdmin, id, name, address, phone, email }) {
        if (!id) return { error: 'school id is required' };
        if (!isValidId(id)) return { error: 'invalid school id' };

        const validationError = await this.validators.school.updateSchool({ name, address, phone, email });
        if (validationError) return { errors: validationError };

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (address !== undefined) updates.address = address;
        if (phone !== undefined) updates.phone = phone;
        if (email !== undefined) updates.email = email;

        const school = await this.mongomodels.school.findByIdAndUpdate(
            id,
            { $set: updates },
            { returnDocument: 'after', runValidators: true }
        );
        if (!school) return { code: 404, error: 'school not found' };

        return { school };
    }

    /** DELETE /api/school/deleteSchool — superadmin only */
    async deleteSchool({ __longToken, __isSuperAdmin, id }) {
        if (!id) return { error: 'school id is required' };
        if (!isValidId(id)) return { error: 'invalid school id' };

        const school = await this.mongomodels.school.findByIdAndDelete(id);
        if (!school) return { code: 404, error: 'school not found' };

        await this.mongomodels.classroom.deleteMany({ schoolId: id });
        await this.mongomodels.user.deleteMany({ role: 'schoolAdmin', schoolId: id });

        return { message: 'school deleted successfully' };
    }

    /**
     * POST /api/school/createSchoolAdmin — superadmin only
     * Creates a user account with role schoolAdmin assigned to a school.
     */
    async createSchoolAdmin({ __longToken, __isSuperAdmin, schoolId, username, email, password }) {
        if (!schoolId) return { error: 'schoolId is required' };
        if (!isValidId(schoolId)) return { error: 'invalid schoolId' };

        const validationError = await this.validators.school.createSchoolAdmin({ username, email, password });
        if (validationError) return { errors: validationError };

        const school = await this.mongomodels.school.findById(schoolId).lean();
        if (!school) return { code: 404, error: 'school not found' };

        const existing = await this.mongomodels.user.findOne({
            $or: [{ email: email.toLowerCase() }, { username }],
        });
        if (existing) return { code: 409, error: 'username or email already in use' };

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userKey = nanoid();

        const user = await this.mongomodels.user.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'schoolAdmin',
            schoolId,
            userKey,
        });

        return {
            message: 'school admin created successfully',
            admin: { id: user._id, username: user.username, email: user.email, schoolId },
        };
    }

    /** GET /api/school/listSchoolAdmins?schoolId=... — superadmin only */
    async listSchoolAdmins({ __longToken, __isSuperAdmin, schoolId, page, limit }) {
        if (!schoolId) return { error: 'schoolId is required' };
        if (!isValidId(schoolId)) return { error: 'invalid schoolId' };

        const school = await this.mongomodels.school.findById(schoolId).lean();
        if (!school) return { code: 404, error: 'school not found' };

        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip     = (pageNum - 1) * limitNum;

        const filter = { role: 'schoolAdmin', schoolId };
        const [admins, total] = await Promise.all([
            this.mongomodels.user.find(filter, 'username email schoolId createdAt')
                .sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            this.mongomodels.user.countDocuments(filter),
        ]);

        return { admins, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
    }
}
