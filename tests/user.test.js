const request = require('supertest');
const { bootApp, teardownApp } = require('./helpers/setup');

let app;
let managers;

beforeAll(async () => {
    ({ app, managers } = await bootApp());
});

afterAll(async () => {
    await teardownApp();
});

describe('User — createSuperAdmin', () => {
    it('rejects invalid admin secret', async () => {
        const res = await request(app)
            .post('/api/user/createSuperAdmin')
            .send({ adminSecret: 'wrong', username: 'admin', email: 'a@a.com', password: 'password123' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    it('creates superadmin with valid secret', async () => {
        const res = await request(app)
            .post('/api/user/createSuperAdmin')
            .send({
                adminSecret: process.env.ADMIN_SECRET,
                username: 'superadmin',
                email: 'super@admin.com',
                password: 'password123',
            });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.longToken).toBeDefined();
        expect(res.body.data.role).toBe('superadmin');
    });

    it('refuses to create a second superadmin', async () => {
        const res = await request(app)
            .post('/api/user/createSuperAdmin')
            .send({
                adminSecret: process.env.ADMIN_SECRET,
                username: 'admin2',
                email: 'super2@admin.com',
                password: 'password123',
            });

        expect(res.status).toBe(409);
        expect(res.body.ok).toBe(false);
    });
});

// createUser is intentionally not exposed — students must be created by school admins
// via POST /api/student/createStudent to ensure they are always assigned to a school.
describe('User — createUser (disabled)', () => {
    it('endpoint is not accessible (students are provisioned by school admins)', async () => {
        const res = await request(app)
            .post('/api/user/createUser')
            .send({ username: 'studentone', email: 'student1@test.com', password: 'password123' });

        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
    });
});

describe('User — loginUser', () => {
    it('returns a token for valid credentials', async () => {
        const res = await request(app)
            .post('/api/user/loginUser')
            .send({ email: 'super@admin.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.longToken).toBeDefined();
    });

    it('rejects wrong password', async () => {
        const res = await request(app)
            .post('/api/user/loginUser')
            .send({ email: 'super@admin.com', password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    it('rejects non-existent user', async () => {
        const res = await request(app)
            .post('/api/user/loginUser')
            .send({ email: 'nobody@nowhere.com', password: 'password123' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    it('returns 400 with errors when password is missing', async () => {
        const res = await request(app)
            .post('/api/user/loginUser')
            .send({ email: 'super@admin.com' });

        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.errors) && res.body.errors.length > 0).toBe(true);
    });
});
