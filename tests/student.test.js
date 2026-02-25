const request = require('supertest');
const { bootApp, teardownApp } = require('./helpers/setup');

let app;
let superAdminToken;
let schoolAdminToken;
let schoolId;
let otherSchoolId;
let classroomId;
let studentId;
let studentToken;

beforeAll(async () => {
    ({ app } = await bootApp());

    // bootstrap superadmin
    await request(app).post('/api/user/createSuperAdmin').send({
        adminSecret: process.env.ADMIN_SECRET,
        username: 'superadmin',
        email: 'super@admin.com',
        password: 'password123',
    });
    const saLogin = await request(app).post('/api/user/loginUser').send({
        email: 'super@admin.com', password: 'password123',
    });
    superAdminToken = saLogin.body.data.longToken;

    // create two schools
    const school1 = await request(app).post('/api/school/createSchool')
        .set('authorization', `Bearer ${superAdminToken}`).send({ name: 'Primary School' });
    schoolId = school1.body.data.school._id;

    const school2 = await request(app).post('/api/school/createSchool')
        .set('authorization', `Bearer ${superAdminToken}`).send({ name: 'Secondary School' });
    otherSchoolId = school2.body.data.school._id;

    // create school admin
    await request(app).post('/api/school/createSchoolAdmin')
        .set('authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId, username: 'adminprimary', email: 'admin@primary.com', password: 'password123' });

    const adminLogin = await request(app).post('/api/user/loginUser').send({
        email: 'admin@primary.com', password: 'password123',
    });
    schoolAdminToken = adminLogin.body.data.longToken;

    // create a classroom
    const classRes = await request(app).post('/api/classroom/createClassroom')
        .set('authorization', `Bearer ${schoolAdminToken}`)
        .send({ name: 'Class A', capacity: 20 });
    classroomId = classRes.body.data.classroom._id;
});

afterAll(async () => {
    await teardownApp();
});

describe('Student — createStudent', () => {
    it('school admin creates a student with linked user account', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({
                name: 'Alice Smith',
                email: 'alice@students.com',
                age: 15,
                username: 'alicesmith',
                password: 'password123',
                classroomId,
            });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.name).toBe('Alice Smith');
        studentId = res.body.data.student._id;
    });

    it('rejects duplicate student email', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({
                name: 'Alice Duplicate',
                email: 'alice@students.com',
                username: 'aliceduplicate',
                password: 'password123',
            });

        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });
});

describe('Student — read and update', () => {
    it('gets a student by id', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: studentId });

        expect(res.status).toBe(200);
        expect(res.body.data.student.name).toBe('Alice Smith');
    });

    it('lists students in the school', async () => {
        const res = await request(app)
            .get('/api/student/listStudents')
            .set('authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.students)).toBe(true);
        expect(res.body.data.students.length).toBeGreaterThan(0);
        expect(res.body.data.pagination).toBeDefined();
    });

    it('lists students filtered by classroomId', async () => {
        const res = await request(app)
            .get('/api/student/listStudents')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ classroomId });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.students)).toBe(true);
        res.body.data.students.forEach(s => {
            expect(s.classroomId._id ?? s.classroomId).toBe(classroomId);
        });
    });

    it('updates student name', async () => {
        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: studentId, name: 'Alice Johnson' });

        expect(res.status).toBe(200);
        expect(res.body.data.student.name).toBe('Alice Johnson');
    });

    it('reassigns student to a different classroom within the same school', async () => {
        const newClassRes = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Class B', capacity: 25 });
        const newClassroomId = newClassRes.body.data.classroom._id;

        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: studentId, classroomId: newClassroomId });

        expect(res.status).toBe(200);
        expect(res.body.data.student.classroomId.toString()).toBe(newClassroomId);
    });
});

describe('Student — myProfile', () => {
    it('student can view their own profile', async () => {
        const loginRes = await request(app).post('/api/user/loginUser').send({
            email: 'alice@students.com', password: 'password123',
        });
        studentToken = loginRes.body.data.longToken;

        const res = await request(app)
            .get('/api/student/myProfile')
            .set('authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student).toBeDefined();
    });

    it('school admin cannot access myProfile endpoint', async () => {
        const res = await request(app)
            .get('/api/student/myProfile')
            .set('authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
    });
});

describe('Student — changePassword', () => {
    it('student can change their own password', async () => {
        const loginRes = await request(app).post('/api/user/loginUser').send({
            email: 'alice@students.com', password: 'password123',
        });
        const token = loginRes.body.data.longToken;

        const res = await request(app)
            .put('/api/student/changePassword')
            .set('authorization', `Bearer ${token}`)
            .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('rejects incorrect current password', async () => {
        const loginRes = await request(app).post('/api/user/loginUser').send({
            email: 'alice@students.com', password: 'newpassword456',
        });
        const token = loginRes.body.data.longToken;

        const res = await request(app)
            .put('/api/student/changePassword')
            .set('authorization', `Bearer ${token}`)
            .send({ currentPassword: 'wrongpassword', newPassword: 'anotherpass123' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    it('school admin cannot access changePassword endpoint', async () => {
        const res = await request(app)
            .put('/api/student/changePassword')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

        expect(res.status).toBe(403);
    });
});

describe('Student — transfer', () => {
    it('transfers a student to another school', async () => {
        const res = await request(app)
            .put('/api/student/transferStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ studentId, targetSchoolId: otherSchoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.student.schoolId).toBe(otherSchoolId);
    });
});

describe('Student — delete', () => {
    it('school admin deletes a student', async () => {
        // create a fresh student to delete (the original was transferred to another school)
        const createRes = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Bob Delete', email: 'bob@delete.com', username: 'bobdelete', password: 'password123' });
        const idToDelete = createRes.body.data.student._id;

        const res = await request(app)
            .delete('/api/student/deleteStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: idToDelete });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        // verify gone
        const getRes = await request(app)
            .get('/api/student/getStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: idToDelete });
        expect(getRes.status).toBe(404);
    });
});

describe('Student — auth guards', () => {
    it('blocks student creation without token', async () => {
        const res = await request(app).post('/api/student/createStudent').send({
            name: 'Bob', email: 'bob@test.com', username: 'bob123', password: 'password123',
        });
        expect(res.status).toBe(401);
    });
});

describe('Student — token invalidation', () => {
    it('old token is rejected after changePassword', async () => {
        // Create a fresh student for this isolated test
        await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'TK User', email: 'tkuser@test.com', username: 'tkuser', password: 'pass1111' });

        const first = await request(app).post('/api/user/loginUser').send({
            email: 'tkuser@test.com', password: 'pass1111',
        });
        const oldToken = first.body.data.longToken;

        // Old token works before password change
        const before = await request(app)
            .get('/api/student/myProfile')
            .set('authorization', `Bearer ${oldToken}`);
        expect(before.status).toBe(200);

        // Change password — rotates userKey in DB
        await request(app)
            .put('/api/student/changePassword')
            .set('authorization', `Bearer ${oldToken}`)
            .send({ currentPassword: 'pass1111', newPassword: 'pass2222' });

        // Old token must now be rejected (userKey no longer matches)
        const after = await request(app)
            .get('/api/student/myProfile')
            .set('authorization', `Bearer ${oldToken}`);
        expect(after.status).toBe(401);

        // New token from fresh login works
        const second = await request(app).post('/api/user/loginUser').send({
            email: 'tkuser@test.com', password: 'pass2222',
        });
        const newToken = second.body.data.longToken;
        const withNew = await request(app)
            .get('/api/student/myProfile')
            .set('authorization', `Bearer ${newToken}`);
        expect(withNew.status).toBe(200);
    });
});

describe('Student — school isolation', () => {
    let adminBToken;
    let isolatedStudentId;

    beforeAll(async () => {
        // Create a student belonging to Primary School (schoolAdminToken's school)
        const cr = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Isolated', email: 'isolated@test.com', username: 'isolatedstu', password: 'pass1234' });
        isolatedStudentId = cr.body.data.student._id;

        // Create admin for Secondary School
        await request(app)
            .post('/api/school/createSchoolAdmin')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ schoolId: otherSchoolId, username: 'adminSecondary', email: 'admin@secondary.com', password: 'pass1234' });
        const lr = await request(app).post('/api/user/loginUser').send({
            email: 'admin@secondary.com', password: 'pass1234',
        });
        adminBToken = lr.body.data.longToken;
    });

    it('school B admin cannot getStudent from school A', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('authorization', `Bearer ${adminBToken}`)
            .query({ id: isolatedStudentId });
        expect(res.status).toBe(403);
    });

    it('school B admin cannot updateStudent from school A', async () => {
        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('authorization', `Bearer ${adminBToken}`)
            .send({ id: isolatedStudentId, name: 'Hacked Name' });
        expect(res.status).toBe(403);
    });

    it('school B admin cannot deleteStudent from school A', async () => {
        const res = await request(app)
            .delete('/api/student/deleteStudent')
            .set('authorization', `Bearer ${adminBToken}`)
            .send({ id: isolatedStudentId });
        expect(res.status).toBe(403);
    });
});

describe('Student — deletion side-effects', () => {
    it('deleting a student also removes their user account', async () => {
        const cr = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Ghost', email: 'ghost@test.com', username: 'ghostuser', password: 'pass1234' });
        const ghostId = cr.body.data.student._id;

        await request(app)
            .delete('/api/student/deleteStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: ghostId });

        // Login should fail — user document was deleted alongside the student
        const loginRes = await request(app).post('/api/user/loginUser').send({
            email: 'ghost@test.com', password: 'pass1234',
        });
        expect(loginRes.body.ok).toBe(false);
        expect(loginRes.body.message).toBe('invalid credentials');
    });
});

describe('Student — superadmin cross-school access', () => {
    it('superadmin can list classrooms from any school', async () => {
        const res = await request(app)
            .get('/api/classroom/listClassrooms')
            .set('authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.classrooms)).toBe(true);
    });

    it('superadmin can getStudent from any school (including after transfer)', async () => {
        // studentId (Alice) was transferred to otherSchoolId in the transfer test
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ id: studentId });
        expect(res.status).toBe(200);
    });
});

describe('Student — invalid id handling', () => {
    it('getStudent with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: 'not-an-id' });
        expect(res.status).toBe(400);
    });

    it('getStudent with non-existent id returns 404', async () => {
        const res = await request(app)
            .get('/api/student/getStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: '000000000000000000000001' });
        expect(res.status).toBe(404);
    });

    it('updateStudent with missing id returns 400', async () => {
        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'No ID here' });
        expect(res.status).toBe(400);
    });

    it('deleteStudent with non-existent id returns 404', async () => {
        const res = await request(app)
            .delete('/api/student/deleteStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: '000000000000000000000001' });
        expect(res.status).toBe(404);
    });
});

describe('Student — validation errors', () => {
    it('createStudent with invalid email returns 400 with errors', async () => {
        const res = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Val Test', email: 'not-an-email', username: 'valtest', password: 'pass1234' });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
    });
});

describe('Student — capacity enforcement', () => {
    let capClassroomId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Tiny Room', capacity: 1 });
        capClassroomId = res.body.data.classroom._id;
    });

    it('createStudent fails with 409 when classroom is full', async () => {
        await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Cap One', email: 'capone@test.com', username: 'capone', password: 'pass1234', classroomId: capClassroomId });

        const res = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Cap Two', email: 'captwo@test.com', username: 'captwo', password: 'pass1234', classroomId: capClassroomId });

        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });

    it('updateStudent fails with 409 when target classroom is full', async () => {
        const cr = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Cap Three', email: 'capthree@test.com', username: 'capthree', password: 'pass1234' });
        const newStudentId = cr.body.data.student._id;

        const res = await request(app)
            .put('/api/student/updateStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: newStudentId, classroomId: capClassroomId });

        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });

    it('transferStudent fails with 409 when target classroom is full', async () => {
        const cr = await request(app)
            .post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Cap Four', email: 'capfour@test.com', username: 'capfour', password: 'pass1234' });
        const newStudentId = cr.body.data.student._id;

        const res = await request(app)
            .put('/api/student/transferStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ studentId: newStudentId, targetSchoolId: schoolId, targetClassroomId: capClassroomId });

        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });
});
