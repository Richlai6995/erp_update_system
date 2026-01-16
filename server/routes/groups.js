const express = require('express');
const router = express.Router();

const { verifyToken } = require('./auth');

// Middleware to ensure Admin access
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理員權限' });
    }
    next();
};

router.use(verifyToken);
router.use(verifyAdmin);

// GET All Groups
router.get('/', (req, res) => {
    try {
        const db = require('../database').db;
        const groups = db.prepare('SELECT * FROM groups').all();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE Group
router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    try {
        const db = require('../database').db;
        const result = db.prepare('INSERT INTO groups (name, description) VALUES (?, ?)').run(name, description);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Group name already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// UPDATE Group
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    try {
        const db = require('../database').db;
        const result = db.prepare('UPDATE groups SET name = ?, description = ? WHERE id = ?').run(name, description, id);
        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Group
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        const db = require('../database').db;
        // Check if used by users
        const users = db.prepare('SELECT count(*) as count FROM users WHERE group_id = ?').get(id);
        if (users.count > 0) {
            return res.status(400).json({ error: 'Cannot delete group with assigned users' });
        }

        const result = db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
