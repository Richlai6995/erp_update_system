const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('./auth');

// Path to docs directory (project root/docs)
const DOCS_DIR = path.join(__dirname, '../../docs');

// GET /api/docs/:type
router.get('/:type', verifyToken, (req, res) => {
    const { type } = req.params;
    let filename = '';

    if (type === 'user') {
        filename = 'USER_MANUAL.md';
    } else if (type === 'admin') {
        // Only admin can access admin manual
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Permission denied' });
        }
        filename = 'ADMIN_MANUAL.md';
    } else {
        return res.status(400).json({ error: 'Invalid document type' });
    }

    const filePath = path.join(DOCS_DIR, filename);

    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } else {
        res.status(404).json({ error: 'Document not found' });
    }
});

module.exports = router;
