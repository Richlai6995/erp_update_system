const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');

// Middleware to ensure Admin access (for settings)
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理員權限' });
    }
    next();
};

router.use(verifyToken);

// GET All Departments (Public to authenticated users for dropdowns)
router.get('/', (req, res) => {
    try {
        const db = require('../database').db;
        const depts = db.prepare('SELECT * FROM departments ORDER BY name').all();
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET Single Department with Approvers
router.get('/:id', (req, res) => {
    const { id } = req.params;
    try {
        const db = require('../database').db;
        const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
        if (!dept) return res.status(404).json({ error: 'Department not found' });

        const approvers = db.prepare('SELECT * FROM department_approvers WHERE department_id = ? ORDER BY step_order').all(id);
        res.json({ ...dept, approvers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Admin Only Below ---
router.use(verifyAdmin);

// CREATE Department
router.post('/', (req, res) => {
    const { name, code, description, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });

    try {
        const db = require('../database').db;
        const result = db.prepare('INSERT INTO departments (name, code, description, active) VALUES (?, ?, ?, ?)').run(name, code, description, active ? 1 : 0);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Department name already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// UPDATE Department
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, code, description, active } = req.body;

    try {
        const db = require('../database').db;
        const result = db.prepare('UPDATE departments SET name = ?, code = ?, description = ?, active = ? WHERE id = ?').run(name, code, description, active ? 1 : 0, id);
        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Department
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        const db = require('../database').db;
        // Check if used by users? (Optional safety check)
        const users = db.prepare('SELECT count(*) as count FROM users WHERE department = (SELECT name FROM departments WHERE id = ?)').get(id);
        if (users && users.count > 0) {
            // return res.status(400).json({ error: 'Cannot delete department with assigned users' });
            // Actually, we are moving to ID reference soon, but currently users table has string 'department'.
            // For now, let's allow delete but warn? The user requirement didn't specify strict constraint.
            // Let's safe check against names for now.
            return res.status(400).json({ error: '尚有使用者屬於此部門，無法刪除' });
        }

        db.prepare('DELETE FROM department_approvers WHERE department_id = ?').run(id);
        const result = db.prepare('DELETE FROM departments WHERE id = ?').run(id);
        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Approver Management ---

// SAVE Approvers (Replace all for simplicity)
router.post('/:id/approvers', (req, res) => {
    const { id } = req.params;
    const { approvers } = req.body; // Expect array of { step_order, user_id, username, notify, active, title }

    if (!Array.isArray(approvers)) return res.status(400).json({ error: 'Invalid format' });

    try {
        const db = require('../database').db;

        // Transaction manually or just sequential runs
        // Note: DatabaseWrapper saves on every run, so we skip explicit transaction to avoid 'no transaction' errors with export()

        // Delete existing
        db.prepare('DELETE FROM department_approvers WHERE department_id = ?').run(id);

        // Insert new
        approvers.forEach(app => {
            db.prepare(`INSERT INTO department_approvers 
            (department_id, step_order, user_id, username, notify, active, proxy_user_id, proxy_start_date, proxy_end_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
                id,
                app.step_order,
                app.user_id,
                app.username,
                app.notify ? 1 : 0,
                app.active ? 1 : 0,
                app.proxy_user_id || null,
                app.proxy_start_date || null,
                app.proxy_end_date || null
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Save Approvers Error:", error);
        try { const db = require('../database').db; db.exec('ROLLBACK'); } catch (e) { }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
