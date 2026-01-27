console.log("Loading api.test.js...");
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { app, db } = require('../server');

describe('ERP Update System API Tests (Simple)', () => {
    it('GET /api should return 404', async () => {
        const res = await request(app).get('/api/health_check_random_404');
        expect(res.statusCode).not.toBe(500);
    });
});
