const { isValidId } = require('../../_common/utils');

module.exports = class ClassroomManager {

    constructor({ validators, mongomodels } = {}) {
        this.validators  = validators;
        this.mongomodels = mongomodels;

        this.httpExposed = [
            'createClassroom',
            'get=getClassroom',
            'get=listClassrooms',
            'put=updateClassroom',
            'delete=deleteClassroom',
        ];
    }

    /** POST /api/classroom/createClassroom — schoolAdmin only */
    async createClassroom({ __longToken, __isSchoolAdmin, name, capacity, resources }) {
        const { schoolId } = __isSchoolAdmin;

        if (!schoolId) return { code: 403, error: 'no school assigned to this admin' };

        const validationError = await this.validators.classroom.createClassroom({ name, capacity, resources });
        if (validationError) return { errors: validationError };

        const school = await this.mongomodels.school.findById(schoolId).lean();
        if (!school) return { code: 404, error: 'assigned school not found' };

        let classroom;
        try {
            classroom = await this.mongomodels.classroom.create({ name, schoolId, capacity, resources });
        } catch (err) {
            if (err.code === 11000) return { code: 409, error: 'a classroom with this name already exists in this school' };
            throw err;
        }

        return { classroom };
    }

    /** GET /api/classroom/getClassroom?id=... — schoolAdmin only */
    async getClassroom({ __longToken, __isSchoolAdmin, id }) {
        if (!id) return { error: 'classroom id is required' };
        if (!isValidId(id)) return { error: 'invalid classroom id' };

        const { schoolId, role } = __isSchoolAdmin;

        const classroom = await this.mongomodels.classroom.findById(id).populate('schoolId', 'name');
        if (!classroom) return { code: 404, error: 'classroom not found' };
        if (!classroom.schoolId) return { code: 404, error: 'classroom school no longer exists' };

        // school admins can only view classrooms in their school
        if (role === 'schoolAdmin' && !classroom.schoolId._id.equals(schoolId)) {
            return { code: 403, error: 'forbidden: classroom belongs to a different school' };
        }

        return { classroom };
    }

    /** GET /api/classroom/listClassrooms — schoolAdmin only */
    async listClassrooms({ __longToken, __isSchoolAdmin, page, limit }) {
        const { schoolId, role } = __isSchoolAdmin;

        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip     = (pageNum - 1) * limitNum;

        const filter = role === 'superadmin' ? {} : { schoolId };
        const [classrooms, total] = await Promise.all([
            this.mongomodels.classroom.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            this.mongomodels.classroom.countDocuments(filter),
        ]);

        return { classrooms, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
    }

    /** PUT /api/classroom/updateClassroom — schoolAdmin only */
    async updateClassroom({ __longToken, __isSchoolAdmin, id, name, capacity, resources }) {
        if (!id) return { error: 'classroom id is required' };
        if (!isValidId(id)) return { error: 'invalid classroom id' };

        const { schoolId, role } = __isSchoolAdmin;

        const validationError = await this.validators.classroom.updateClassroom({ name, capacity, resources });
        if (validationError) return { errors: validationError };

        const classroom = await this.mongomodels.classroom.findById(id).lean();
        if (!classroom) return { code: 404, error: 'classroom not found' };

        if (role === 'schoolAdmin' && !classroom.schoolId.equals(schoolId)) {
            return { code: 403, error: 'forbidden: classroom belongs to a different school' };
        }

        const updates = {};
        if (name !== undefined)      updates.name      = name;
        if (capacity !== undefined)  updates.capacity  = capacity;
        if (resources !== undefined) updates.resources = resources;

        const updated = await this.mongomodels.classroom.findByIdAndUpdate(
            id,
            { $set: updates },
            { returnDocument: 'after', runValidators: true }
        );

        return { classroom: updated };
    }

    /** DELETE /api/classroom/deleteClassroom — schoolAdmin only */
    async deleteClassroom({ __longToken, __isSchoolAdmin, id }) {
        if (!id) return { error: 'classroom id is required' };
        if (!isValidId(id)) return { error: 'invalid classroom id' };

        const { schoolId, role } = __isSchoolAdmin;

        const classroom = await this.mongomodels.classroom.findById(id).lean();
        if (!classroom) return { code: 404, error: 'classroom not found' };

        if (role === 'schoolAdmin' && !classroom.schoolId.equals(schoolId)) {
            return { code: 403, error: 'forbidden: classroom belongs to a different school' };
        }

        await this.mongomodels.classroom.findByIdAndDelete(id);

        return { message: 'classroom deleted successfully' };
    }
}
