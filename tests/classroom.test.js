const request = require('supertest');
const { bootApp, teardownApp } = require('./helpers/setup');

let app;
let superAdminToken;
let schoolAdminToken;
let schoolId;
let otherSchoolId;
let classroomId;

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
        .set('authorization', `Bearer ${superAdminToken}`).send({ name: 'School A' });
    schoolId = school1.body.data.school._id;

    const school2 = await request(app).post('/api/school/createSchool')
        .set('authorization', `Bearer ${superAdminToken}`).send({ name: 'School B' });
    otherSchoolId = school2.body.data.school._id;

    // create school admin for school A
    await request(app).post('/api/school/createSchoolAdmin')
        .set('authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId, username: 'adminA', email: 'admin@schoola.com', password: 'password123' });

    const adminLogin = await request(app).post('/api/user/loginUser').send({
        email: 'admin@schoola.com', password: 'password123',
    });
    schoolAdminToken = adminLogin.body.data.longToken;
});

afterAll(async () => {
    await teardownApp();
});

describe('Classroom — CRUD', () => {
    it('school admin creates a classroom in their school', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Room 101', capacity: 30 });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.classroom.name).toBe('Room 101');
        classroomId = res.body.data.classroom._id;
    });

    it('lists classrooms for the admin school only', async () => {
        const res = await request(app)
            .get('/api/classroom/listClassrooms')
            .set('authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.classrooms)).toBe(true);
    });

    it('gets a classroom by id', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: classroomId });

        expect(res.status).toBe(200);
        expect(res.body.data.classroom._id).toBe(classroomId);
    });

    it('updates a classroom', async () => {
        const res = await request(app)
            .put('/api/classroom/updateClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: classroomId, capacity: 35 });

        expect(res.status).toBe(200);
        expect(res.body.data.classroom.capacity).toBe(35);
    });
});

describe('Classroom — CRUD (continued)', () => {
    it('deletes a classroom', async () => {
        const createRes = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Room To Delete', capacity: 10 });
        const idToDelete = createRes.body.data.classroom._id;

        const res = await request(app)
            .delete('/api/classroom/deleteClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: idToDelete });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

describe('Classroom — school isolation', () => {
    it('blocks creating a classroom without a token', async () => {
        const res = await request(app).post('/api/classroom/createClassroom').send({ name: 'Hack Room', capacity: 10 });
        expect(res.status).toBe(401);
    });

    it('blocks a student from creating classrooms', async () => {
        // create a student via school admin (proper flow — createUser is not a public endpoint)
        await request(app).post('/api/student/createStudent')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Test Student', username: 'stu99', email: 'stu99@test.com', password: 'password123' });
        const login = await request(app).post('/api/user/loginUser').send({
            email: 'stu99@test.com', password: 'password123',
        });
        const studentToken = login.body.data.longToken;

        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${studentToken}`)
            .send({ name: 'Hack Room', capacity: 10 });

        expect(res.status).toBe(403);
    });

    it('blocks admin of school B from reading a classroom in school A', async () => {
        // create a school admin for the other school
        await request(app).post('/api/school/createSchoolAdmin')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ schoolId: otherSchoolId, username: 'adminB', email: 'admin@schoolb.com', password: 'password123' });
        const loginB = await request(app).post('/api/user/loginUser').send({
            email: 'admin@schoolb.com', password: 'password123',
        });
        const adminBToken = loginB.body.data.longToken;

        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('authorization', `Bearer ${adminBToken}`)
            .query({ id: classroomId });

        expect(res.status).toBe(403);
    });

    it('blocks admin of school B from updating a classroom in school A', async () => {
        const loginB = await request(app).post('/api/user/loginUser').send({
            email: 'admin@schoolb.com', password: 'password123',
        });
        const adminBToken = loginB.body.data.longToken;

        const res = await request(app)
            .put('/api/classroom/updateClassroom')
            .set('authorization', `Bearer ${adminBToken}`)
            .send({ id: classroomId, capacity: 999 });

        expect(res.status).toBe(403);
    });
});

describe('Classroom — invalid id handling', () => {
    it('getClassroom with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: 'not-an-id' });
        expect(res.status).toBe(400);
    });

    it('getClassroom with non-existent id returns 404', async () => {
        const res = await request(app)
            .get('/api/classroom/getClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .query({ id: '000000000000000000000001' });
        expect(res.status).toBe(404);
    });

    it('updateClassroom with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .put('/api/classroom/updateClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: 'not-an-id', capacity: 50 });
        expect(res.status).toBe(400);
    });

    it('deleteClassroom with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .delete('/api/classroom/deleteClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ id: 'not-an-id' });
        expect(res.status).toBe(400);
    });
});

describe('Classroom — validation errors', () => {
    it('createClassroom with missing capacity returns 400 with errors', async () => {
        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'No Capacity Room' });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
    });

    it('duplicate classroom name in same school returns 409', async () => {
        await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Duplicate Room', capacity: 20 });

        const res = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Duplicate Room', capacity: 20 });

        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });
});
