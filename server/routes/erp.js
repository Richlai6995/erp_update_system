const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');

// Get all modules
router.get('/', verifyToken, (req, res) => {
    try {
        const db = require('../database').db;
        const modules = db.prepare('SELECT * FROM erp_modules ORDER BY code').all();
        res.json(modules);
    } catch (error) {
        console.error('Error fetching modules:', error);
        res.status(500).json({ error: 'Failed to fetch modules' });
    }
});

// Create module
router.post('/', verifyToken, (req, res) => {
    // Only Admin?
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { name, code, form_path, report_path, path_code } = req.body;
    if (!name || !code || !path_code) { // path_code required now
        return res.status(400).json({ error: 'Name, Code, and Path Code are required' });
    }

    try {
        const db = require('../database').db;
        const info = db.prepare(`
            INSERT INTO erp_modules (name, code, form_path, report_path, path_code)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, code, form_path, report_path, path_code);

        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Module code must be unique' });
        }
        res.status(500).json({ error: 'Failed to create module' });
    }
});

// Update module
router.put('/:id', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { name, code, form_path, report_path, path_code } = req.body;
    const { id } = req.params;

    try {
        const db = require('../database').db;
        db.prepare(`
            UPDATE erp_modules 
            SET name = ?, code = ?, form_path = ?, report_path = ?, path_code = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(name, code, form_path, report_path, path_code, id);

        res.json({ id, name, code, form_path, report_path, path_code });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update module' });
    }
});

// Delete module
router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { id } = req.params;

    try {
        const db = require('../database').db;
        db.prepare('DELETE FROM erp_modules WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete module' });
    }
});

module.exports = router;
