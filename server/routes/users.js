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

// Apply verifyAdmin only to modification routes
const verifyAdminForModifications = (req, res, next) => {
    if (req.method !== 'GET' && req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理員權限' });
    }
    next();
};

router.use(verifyAdminForModifications);

// GET Current User (Must be before dynamic :id routes if we had any, or just here is fine)
router.get('/me', (req, res) => {
    // req.user is populated by verifyToken
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    // Return safe user info
    res.json({
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        role: req.user.role,
        department: req.user.department,
        email: req.user.email
    });
});


// GET All Users or Search
router.get('/', (req, res) => {
    try {
        const db = require('../database').db;
        console.log(`[Users API] Request from ${req.user.username} (${req.user.role})`);

        // If Admin, return full details
        if (req.user.role === 'admin') {
            const users = db.prepare(`
                SELECT u.id, u.username, u.name, u.employee_id, u.email, u.role, u.start_date, u.end_date, u.status, 
                (CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) as is_active,
                u.department
                FROM users u
            `).all();
            console.log(`[Users API] Returning ${users.length} users for admin.`);
            return res.json(users);
        }

        // If not Admin, return simplified list for selection
        // OLD: Only return active users in the SAME project_root
        // NEW: Return all active users (or filter by department if needed?)
        // For now, return all active users for simplicity as project_root is removed.
        const users = db.prepare("SELECT id, username, name, department FROM users WHERE status = 'active'").all();
        console.log(`[Users API] Returning ${users.length} users for non-admin.`);
        res.json(users);

    } catch (error) {
        console.error("[Users API] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// CREATE User
router.post('/', (req, res) => {
    const { username, password, name, employee_id, email, role, start_date, end_date, is_active, department } = req.body;

    if (!username || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields (Username, Password, Name)' });
    }

    try {
        const db = require('../database').db;
        const stmt = db.prepare(`
      INSERT INTO users (username, password, name, employee_id, email, role, start_date, end_date, status, department)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        // Default is_active to true if undefined, mapping to 'active'/'inactive'
        const statusVal = (is_active === undefined || is_active) ? 'active' : 'inactive';

        // Sanitize optional unique fields: empty string should be NULL
        const empIdVal = employee_id && employee_id.trim() !== '' ? employee_id.trim() : null;
        const emailVal = email && email.trim() !== '' ? email.trim() : null;

        const result = stmt.run(username, password, name, empIdVal, emailVal, role || 'user', start_date, end_date, statusVal, department || null);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
        console.error("Create User Error:", err);
        // sql.js might return generic error with message containing 'UNIQUE constraint failed'
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
            // Try to extract which column failed
            return res.status(400).json({ error: 'Data already exists (Unique Constraint Violation): ' + err.message });
        }
        res.status(500).json({ error: err.toString() });
    }
});

// UPDATE User
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { password, name, employee_id, email, role, start_date, end_date, is_active, department } = req.body;

    // Check permissions: Admin can update anyone. User can update self (if we allow, but middleware blocks).
    // The middleware 'verifyAdminForModifications' is active. 

    try {
        const db = require('../database').db;
        // Check if trying to edit ADMIN role
        const specificUser = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
        if (specificUser && specificUser.username === 'ADMIN' && role !== 'admin') {
            return res.status(400).json({ error: 'Cannot remove admin role from default ADMIN account' });
        }

        const statusVal = is_active ? 'active' : 'inactive';

        // Sanitize optional unique fields
        const empIdVal = employee_id && employee_id.trim() !== '' ? employee_id.trim() : null;
        const emailVal = email && email.trim() !== '' ? email.trim() : null;

        let sql, params;
        if (password) {
            sql = `UPDATE users SET password=?, name=?, employee_id=?, email=?, role=?, start_date=?, end_date=?, status=?, department=? WHERE id=?`;
            params = [password, name, empIdVal, emailVal, role, start_date, end_date, statusVal, department || null, id];
        } else {
            sql = `UPDATE users SET name=?, employee_id=?, email=?, role=?, start_date=?, end_date=?, status=?, department=? WHERE id=?`;
            params = [name, empIdVal, emailVal, role, start_date, end_date, statusVal, department || null, id];
        }

        const result = db.prepare(sql).run(...params);
        res.json({ changes: result.changes, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE User
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        const db = require('../database').db;
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
        if (user && user.username === 'ADMIN') {
            return res.status(403).json({ error: 'Cannot delete default admin' });
        }

        const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        res.json({ changes: result.changes, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
