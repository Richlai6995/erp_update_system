const express = require('express');
const app = express();

// Mock dependencies
process.env.JWT_SECRET = 'test';
const dbExports = require('./database');
dbExports.init = async () => { }; // Mock init
dbExports.db = { prepare: () => ({ get: () => { }, all: () => { }, run: () => { } }) }; // Mock DB

// Import Router
try {
    const requestRoutes = require('./routes/requests');
    app.use('/api/requests', requestRoutes);

    console.log('--- Request Routes ---');
    requestRoutes.stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log(`${methods.padEnd(7)} /api/requests${layer.route.path}`);
        }
    });

    console.log('\n--- Public Routes ---');
    const publicRoutes = require('./routes/public_approval');
    app.use('/api/public', publicRoutes);
    publicRoutes.stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
            console.log(`${methods.padEnd(7)} /api/public${layer.route.path}`);
        }
    });

} catch (e) {
    console.error('Error loading routes:', e);
}
