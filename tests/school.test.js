const request = require('supertest');
const { bootApp, teardownApp } = require('./helpers/setup');

let app;
let superAdminToken;
let schoolId;

beforeAll(async () => {
    ({ app } = await bootApp());

    // create and login superadmin
    await request(app).post('/api/user/createSuperAdmin').send({
        adminSecret: process.env.ADMIN_SECRET,
        username: 'superadmin',
        email: 'super@admin.com',
        password: 'password123',
    });
    const loginRes = await request(app).post('/api/user/loginUser').send({
        email: 'super@admin.com',
        password: 'password123',
    });
    superAdminToken = loginRes.body.data.longToken;
});

afterAll(async () => {
    await teardownApp();
});

describe('School — CRUD (superadmin)', () => {
    it('creates a school', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Test Academy', address: '123 Main St', email: 'info@testacademy.com' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.school.name).toBe('Test Academy');
        schoolId = res.body.data.school._id;
    });

    it('lists schools', async () => {
        const res = await request(app)
            .get('/api/school/listSchools')
            .set('authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(Array.isArray(res.body.data.schools)).toBe(true);
        expect(res.body.data.schools.length).toBeGreaterThan(0);
    });

    it('gets a single school by id', async () => {
        const res = await request(app)
            .get('/api/school/getSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ id: schoolId });

        expect(res.status).toBe(200);
        expect(res.body.data.school._id).toBe(schoolId);
    });

    it('updates a school', async () => {
        const res = await request(app)
            .put('/api/school/updateSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ id: schoolId, name: 'Updated Academy' });

        expect(res.status).toBe(200);
        expect(res.body.data.school.name).toBe('Updated Academy');
    });

    it('deletes a school', async () => {
        const createRes = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'To Delete' });

        const idToDelete = createRes.body.data.school._id;
        const res = await request(app)
            .delete('/api/school/deleteSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ id: idToDelete });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

describe('School — duplicate name', () => {
    it('creating a school with a duplicate name returns 409', async () => {
        await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Duplicate School' });

        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Duplicate School' });
        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });
});

describe('School — auth guards', () => {
    it('blocks requests without a token', async () => {
        const res = await request(app).post('/api/school/createSchool').send({ name: 'Unauthorized' });
        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    it('blocks non-superadmin from creating schools', async () => {
        // create a school admin and use their token to attempt school creation
        await request(app).post('/api/school/createSchoolAdmin')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ schoolId, username: 'notanadmin', email: 'schooladmin@guard.com', password: 'password123' });
        const loginRes = await request(app).post('/api/user/loginUser').send({
            email: 'schooladmin@guard.com', password: 'password123',
        });
        const schoolAdminToken = loginRes.body.data.longToken;

        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Unauthorized School' });

        expect(res.status).toBe(403);
        expect(res.body.ok).toBe(false);
    });
});

describe('School — listSchoolAdmins', () => {
    it('lists admins for a school', async () => {
        const res = await request(app)
            .get('/api/school/listSchoolAdmins')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ schoolId });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(Array.isArray(res.body.data.admins)).toBe(true);
        expect(res.body.data.admins.length).toBeGreaterThan(0);
        expect(res.body.data.pagination).toBeDefined();
    });

    it('returns 400 when schoolId is missing', async () => {
        const res = await request(app)
            .get('/api/school/listSchoolAdmins')
            .set('authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(400);
    });
});

describe('School — pagination', () => {
    it('listSchools returns pagination metadata', async () => {
        const res = await request(app)
            .get('/api/school/listSchools')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ page: 1, limit: 5 });

        expect(res.status).toBe(200);
        expect(res.body.data.pagination).toMatchObject({
            page: 1,
            limit: 5,
        });
        expect(typeof res.body.data.pagination.total).toBe('number');
        expect(typeof res.body.data.pagination.totalPages).toBe('number');
    });
});

describe('School — invalid id handling', () => {
    it('getSchool with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .get('/api/school/getSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ id: 'not-an-id' });
        expect(res.status).toBe(400);
    });

    it('getSchool with non-existent id returns 404', async () => {
        const res = await request(app)
            .get('/api/school/getSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ id: '000000000000000000000001' });
        expect(res.status).toBe(404);
    });

    it('updateSchool with missing id returns 400', async () => {
        const res = await request(app)
            .put('/api/school/updateSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'No ID' });
        expect(res.status).toBe(400);
    });

    it('deleteSchool with non-existent id returns 404', async () => {
        const res = await request(app)
            .delete('/api/school/deleteSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ id: '000000000000000000000001' });
        expect(res.status).toBe(404);
    });

    it('updateSchool with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .put('/api/school/updateSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ id: 'not-an-id', name: 'Bad' });
        expect(res.status).toBe(400);
    });

    it('deleteSchool with invalid ObjectId returns 400', async () => {
        const res = await request(app)
            .delete('/api/school/deleteSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ id: 'not-an-id' });
        expect(res.status).toBe(400);
    });

    it('createSchoolAdmin with invalid schoolId returns 400', async () => {
        const res = await request(app)
            .post('/api/school/createSchoolAdmin')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ schoolId: 'not-an-id', username: 'x', email: 'x@x.com', password: 'password123' });
        expect(res.status).toBe(400);
    });
});

describe('School — validation errors', () => {
    it('createSchool with missing name returns 400 with errors', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({});
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
    });

    it('createSchool with invalid phone returns 400 with errors', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Phone Test School', phone: '555-1234ee' });
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
    });

    it('malformed JSON body returns 400', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('Content-Type', 'application/json')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send('{ not valid json }');
        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });
});

describe('School — cascade delete', () => {
    it('deleting a school also removes its classrooms', async () => {
        const schoolRes = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Cascade School' });
        const cascadeSchoolId = schoolRes.body.data.school._id;

        // create a school admin to create a classroom
        await request(app)
            .post('/api/school/createSchoolAdmin')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ schoolId: cascadeSchoolId, username: 'cascadeadmin', email: 'cascade@admin.com', password: 'password123' });
        const loginRes = await request(app).post('/api/user/loginUser').send({ email: 'cascade@admin.com', password: 'password123' });
        const adminToken = loginRes.body.data.longToken;

        const classRes = await request(app)
            .post('/api/classroom/createClassroom')
            .set('authorization', `Bearer ${adminToken}`)
            .send({ name: 'Cascade Room', capacity: 30 });
        expect(classRes.status).toBe(200);
        const classroomId = classRes.body.data.classroom._id;

        // delete the school
        await request(app)
            .delete('/api/school/deleteSchool')
            .set('authorization', `Bearer ${superAdminToken}`)
            .send({ id: cascadeSchoolId });

        // classroom should no longer exist
        const getRes = await request(app)
            .get('/api/classroom/getClassroom')
            .set('authorization', `Bearer ${superAdminToken}`)
            .query({ id: classroomId });
        expect(getRes.status).toBe(404);

        // school admin token should now be invalid (user deleted)
        const adminRes = await request(app)
            .get('/api/classroom/listClassrooms')
            .set('authorization', `Bearer ${adminToken}`);
        expect(adminRes.status).toBe(401);
    });
});

describe('Routing errors', () => {
    it('GET /api/school/createSchool returns 405 (function exists under POST)', async () => {
        const res = await request(app).get('/api/school/createSchool');
        expect(res.status).toBe(405);
        expect(res.body.ok).toBe(false);
    });

    it('GET /api/school/doesNotExist returns 404', async () => {
        const res = await request(app).get('/api/school/doesNotExist');
        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
    });

    it('GET /api/unknown/anything returns 404', async () => {
        const res = await request(app).get('/api/unknown/anything');
        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
    });
});

describe('Middleware — authorization header', () => {
    it('rejects non-Bearer auth scheme', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', 'Token sometoken')
            .send({ name: 'X' });
        expect(res.status).toBe(401);
    });

    it('rejects Bearer with no token value', async () => {
        const res = await request(app)
            .post('/api/school/createSchool')
            .set('authorization', 'Bearer')
            .send({ name: 'X' });
        expect(res.status).toBe(401);
    });
});
