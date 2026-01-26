const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set Env BEFORE requiring app
const TEST_DB = path.join(__dirname, 'test.db');
process.env.DB_PATH = TEST_DB;
process.env.PORT = 3004; // Use different port for testing context if needed

const { app, db } = require('../server');

describe('ERP Update System API Tests', () => {
    let token = '';

    beforeAll(async () => {
        // Remove test DB if exists
        if (fs.existsSync(TEST_DB)) {
            try { fs.unlinkSync(TEST_DB); } catch (e) { }
        }

        // Initialize Database
        await db.init();
    });

    afterAll(async () => {
        // Close DB connection if possible or just cleanup file
        if (fs.existsSync(TEST_DB)) {
            try { fs.unlinkSync(TEST_DB); } catch (e) { }
        }
        if (fs.existsSync(TEST_DB + '.tmp')) {
            try { fs.unlinkSync(TEST_DB + '.tmp'); } catch (e) { }
        }
    });

    it('GET /api should return 404 or 200 (sanity check)', async () => {
        // The root path generally performs a redirect or serves static files, 
        // but /api/something_random should 404 json
        const res = await request(app).get('/api/health_check_random_404');
        expect(res.statusCode).not.toBe(500);
    });

    it('should be able to login as default ADMIN', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'ADMIN',
                password: 'admin'
            });

        if (res.statusCode !== 200) {
            console.error('Login Failed:', res.body);
        }

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        token = res.body.token;
    });

    it('should get current user profile with token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.username).toBe('ADMIN');
    });

    it('should list users (Admin only)', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('should fail to access protected route without token', async () => {
        const res = await request(app).get('/api/users');
        expect(res.statusCode).toBe(403); // Or 401 depending on middleware
    });
});
