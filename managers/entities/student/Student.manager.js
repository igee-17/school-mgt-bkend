const bcrypt     = require('bcrypt');
const { nanoid } = require('nanoid');
const { isValidId } = require('../../_common/utils');

const BCRYPT_ROUNDS = 10;

module.exports = class StudentManager {

    constructor({ config, managers, validators, mongomodels, cache } = {}) {
        this.config       = config;
        this.validators   = validators;
        this.mongomodels  = mongomodels;
        this.cache        = cache;
        this.tokenManager = managers.token;

        this.httpExposed = [
            'createStudent',
            'get=getStudent',
            'get=listStudents',
            'put=updateStudent',
            'delete=deleteStudent',
            'put=transferStudent',
            'get=myProfile',
            'put=changePassword',
        ];
    }

    /**
     * POST /api/student/createStudent — schoolAdmin only
     * Creates a Student record and a linked User account with role 'student'.
     */
    async createStudent({ __longToken, __isSchoolAdmin, name, email, age, username, password, classroomId }) {
        const { schoolId, role } = __isSchoolAdmin;

        if (!schoolId) return { code: 403, error: 'no school assigned to this admin' };

        const validationError = await this.validators.student.createStudent({ name, email, age, username, password });
        if (validationError) return { errors: validationError };

        const school = await this.mongomodels.school.findById(schoolId).lean();
        if (!school) return { code: 404, error: 'school not found' };

        if (classroomId) {
            if (!isValidId(classroomId)) return { error: 'invalid classroomId' };
            const classroom = await this.mongomodels.classroom.findById(classroomId).lean();
            if (!classroom) return { code: 404, error: 'classroom not found' };
            if (!classroom.schoolId.equals(schoolId)) {
                return { code: 403, error: 'classroom belongs to a different school' };
            }
            const count = await this.mongomodels.student.countDocuments({ classroomId });
            if (count >= classroom.capacity) {
                return { code: 409, error: `classroom is at full capacity (${classroom.capacity})` };
            }
        }

        const existingStudent = await this.mongomodels.student.findOne({ email: email.toLowerCase() });
        if (existingStudent) return { code: 409, error: 'a student with this email already exists' };

        const existingUser = await this.mongomodels.user.findOne({
            $or: [{ email: email.toLowerCase() }, { username }],
        });
        if (existingUser) return { code: 409, error: 'username or email already in use' };

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userKey = nanoid();

        const user = await this.mongomodels.user.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'student',
            schoolId,
            userKey,
        });

        const student = await this.mongomodels.student.create({
            name,
            email: email.toLowerCase(),
            age,
            schoolId,
            classroomId: classroomId || null,
            userId: user._id,
        });

        return { student };
    }

    /** GET /api/student/getStudent?id=... — schoolAdmin only */
    async getStudent({ __longToken, __isSchoolAdmin, id }) {
        if (!id) return { error: 'student id is required' };
        if (!isValidId(id)) return { error: 'invalid student id' };

        const { schoolId, role } = __isSchoolAdmin;

        const student = await this.mongomodels.student.findById(id)
            .populate('schoolId', 'name')
            .populate('classroomId', 'name');
        if (!student) return { code: 404, error: 'student not found' };
        if (!student.schoolId) return { code: 404, error: 'student school no longer exists' };

        if (role === 'schoolAdmin' && !student.schoolId._id.equals(schoolId)) {
            return { code: 403, error: 'forbidden: student belongs to a different school' };
        }

        return { student };
    }

    /** GET /api/student/listStudents — schoolAdmin only */
    async listStudents({ __longToken, __isSchoolAdmin, classroomId, page, limit }) {
        const { schoolId, role } = __isSchoolAdmin;

        const filter = role === 'superadmin' ? {} : { schoolId };
        if (classroomId) {
            if (!isValidId(classroomId)) return { error: 'invalid classroomId' };
            filter.classroomId = classroomId;
        }

        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip     = (pageNum - 1) * limitNum;

        const [students, total] = await Promise.all([
            this.mongomodels.student.find(filter)
                .populate('classroomId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            this.mongomodels.student.countDocuments(filter),
        ]);

        return { students, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
    }

    /** PUT /api/student/updateStudent — schoolAdmin only */
    async updateStudent({ __longToken, __isSchoolAdmin, id, name, age, classroomId }) {
        if (!id) return { error: 'student id is required' };
        if (!isValidId(id)) return { error: 'invalid student id' };

        const { schoolId, role } = __isSchoolAdmin;

        const validationError = await this.validators.student.updateStudent({ name, age });
        if (validationError) return { errors: validationError };

        const updates = {};
        if (name !== undefined)        updates.name        = name;
        if (age !== undefined)         updates.age         = age;
        if (classroomId !== undefined) updates.classroomId = classroomId || null;

        if (Object.keys(updates).length === 0) {
            return { error: 'no fields provided to update' };
        }

        const student = await this.mongomodels.student.findById(id).lean();
        if (!student) return { code: 404, error: 'student not found' };

        if (role === 'schoolAdmin' && !student.schoolId.equals(schoolId)) {
            return { code: 403, error: 'forbidden: student belongs to a different school' };
        }

        if (classroomId) {
            if (!isValidId(classroomId)) return { error: 'invalid classroomId' };
            const classroom = await this.mongomodels.classroom.findById(classroomId).lean();
            if (!classroom) return { code: 404, error: 'classroom not found' };
            const targetSchoolId = role === 'schoolAdmin' ? schoolId : student.schoolId;
            if (!classroom.schoolId.equals(targetSchoolId)) {
                return { code: 403, error: 'classroom belongs to a different school' };
            }
            const count = await this.mongomodels.student.countDocuments({ classroomId, _id: { $ne: id } });
            if (count >= classroom.capacity) {
                return { code: 409, error: `classroom is at full capacity (${classroom.capacity})` };
            }
        }

        const updated = await this.mongomodels.student.findByIdAndUpdate(
            id,
            { $set: updates },
            { returnDocument: 'after', runValidators: true }
        );

        return { student: updated };
    }

    /** DELETE /api/student/deleteStudent — schoolAdmin only */
    async deleteStudent({ __longToken, __isSchoolAdmin, id }) {
        if (!id) return { error: 'student id is required' };
        if (!isValidId(id)) return { error: 'invalid student id' };

        const { schoolId, role } = __isSchoolAdmin;

        const student = await this.mongomodels.student.findById(id).lean();
        if (!student) return { code: 404, error: 'student not found' };

        if (role === 'schoolAdmin' && !student.schoolId.equals(schoolId)) {
            return { code: 403, error: 'forbidden: student belongs to a different school' };
        }

        await this.mongomodels.student.findByIdAndDelete(id);
        if (student.userId) {
            await this.mongomodels.user.findByIdAndDelete(student.userId);
        }

        return { message: 'student deleted successfully' };
    }

    /**
     * POST /api/student/transferStudent — schoolAdmin only
     * Move a student to a different school and/or classroom.
     */
    async transferStudent({ __longToken, __isSchoolAdmin, studentId, targetSchoolId, targetClassroomId }) {
        const validationError = await this.validators.student.transferStudent({ studentId, targetSchoolId });
        if (validationError) return { errors: validationError };

        if (!isValidId(studentId))      return { error: 'invalid studentId' };
        if (!isValidId(targetSchoolId)) return { error: 'invalid targetSchoolId' };
        if (targetClassroomId && !isValidId(targetClassroomId)) return { error: 'invalid targetClassroomId' };

        const { schoolId, role } = __isSchoolAdmin;

        const student = await this.mongomodels.student.findById(studentId).lean();
        if (!student) return { code: 404, error: 'student not found' };

        if (role === 'schoolAdmin' && !student.schoolId.equals(schoolId)) {
            return { code: 403, error: 'forbidden: student belongs to a different school' };
        }

        const targetSchool = await this.mongomodels.school.findById(targetSchoolId).lean();
        if (!targetSchool) return { code: 404, error: 'target school not found' };

        if (targetClassroomId) {
            const targetClassroom = await this.mongomodels.classroom.findById(targetClassroomId).lean();
            if (!targetClassroom) return { code: 404, error: 'target classroom not found' };
            if (!targetClassroom.schoolId.equals(targetSchoolId)) {
                return { code: 403, error: 'target classroom does not belong to the target school' };
            }
            const count = await this.mongomodels.student.countDocuments({ classroomId: targetClassroomId });
            if (count >= targetClassroom.capacity) {
                return { code: 409, error: `target classroom is at full capacity (${targetClassroom.capacity})` };
            }
        }

        const updated = await this.mongomodels.student.findByIdAndUpdate(
            studentId,
            { $set: { schoolId: targetSchoolId, classroomId: targetClassroomId || null } },
            { returnDocument: 'after' }
        );
        if (student.userId) {
            await this.mongomodels.user.findByIdAndUpdate(
                student.userId,
                { $set: { schoolId: targetSchoolId } }
            );
        }

        return { student: updated, message: 'student transferred successfully' };
    }

    /**
     * GET /api/student/myProfile — student role only
     * A logged-in student views their own profile.
     */
    async myProfile({ __longToken, __isStudent }) {
        const { userId } = __isStudent;

        const student = await this.mongomodels.student.findOne({ userId })
            .populate('schoolId', 'name address')
            .populate('classroomId', 'name capacity')
            .lean();

        if (!student) return { code: 404, error: 'student profile not found' };

        return { student };
    }

    /**
     * PUT /api/student/changePassword — student role only
     * Student changes their own password. Rotates userKey to invalidate existing tokens.
     */
    async changePassword({ __longToken, __isStudent, currentPassword, newPassword }) {
        const { userId } = __isStudent;

        const validationError = await this.validators.student.changePassword({ currentPassword, newPassword });
        if (validationError) return { errors: validationError };

        const user = await this.mongomodels.user.findById(userId);
        if (!user) return { code: 404, error: 'user not found' };

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) return { code: 401, error: 'current password is incorrect' };

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        const newUserKey     = nanoid();

        await this.mongomodels.user.findByIdAndUpdate(userId, {
            $set: { password: hashedPassword, userKey: newUserKey },
        });

        // Invalidate cached userKey so next request re-validates against the new key
        try { await this.cache.del(`userkey:${userId}`); } catch (_) { /* non-fatal */ }

        return { message: 'password changed successfully' };
    }
}
