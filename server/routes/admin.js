const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken } = require('./auth');
const dbModule = require('../database');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../system.db');

// Middleware to check Admin Role
const checkAdmin = (req, res, next) => {
    // req.user is populated by verifyToken
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied. Admin only." });
    }
    next();
};

// Setup Upload for DB Import
const upload = multer({ dest: path.join(__dirname, '../uploads/temp') });

// GET /api/admin/db/export
router.get('/db/export', verifyToken, checkAdmin, (req, res) => {
    if (fs.existsSync(DB_PATH)) {
        res.download(DB_PATH, `system_backup_${new Date().toISOString().split('T')[0]}.db`);
    } else {
        res.status(404).json({ error: "Database file not found" });
    }
});

// POST /api/admin/db/import
router.post('/db/import', verifyToken, checkAdmin, upload.single('dbFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const uploadedPath = req.file.path;

        // Safety: Backup current DB before replacement?
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, DB_PATH + '.bak');
        }

        // Replace DB
        // Using atomic move/copy strategy
        fs.copyFileSync(uploadedPath, DB_PATH);

        // Clean up temp upload
        fs.unlinkSync(uploadedPath);

        // Reload DB in memory
        await dbModule.reload();

        res.json({ success: true, message: "Database imported successfully. System reloaded." });
    } catch (e) {
        console.error("Import failed", e);
        res.status(500).json({ error: "Failed to import database" });
    }
});

// --- System Settings Routes ---

const envManager = require('../services/envManager');

// GET /api/admin/settings/env
router.get('/settings/env', verifyToken, checkAdmin, (req, res) => {
    try {
        const settings = envManager.getEnvSettings();
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/settings/env
router.post('/settings/env', verifyToken, checkAdmin, (req, res) => {
    try {
        envManager.updateEnvSettings(req.body);
        res.json({ success: true, message: "Environment settings updated. Please restart server." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- DB Object Types Routes ---

// GET /api/admin/settings/db-object-types
router.get('/settings/db-object-types', verifyToken, (req, res) => {
    try {
        const db = require('../database').db;
        const types = db.prepare('SELECT * FROM db_object_types ORDER BY name').all();
        res.json(types);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/settings/db-object-types
router.post('/settings/db-object-types', verifyToken, checkAdmin, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
        const db = require('../database').db;
        const result = db.prepare("INSERT INTO db_object_types (name) VALUES (?)").run(name);
        res.json({ id: result.lastInsertRowid, success: true });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: "Type already exists" });
        }
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/settings/db-object-types/:id
router.delete('/settings/db-object-types/:id', verifyToken, checkAdmin, (req, res) => {
    const { id } = req.params;
    try {
        const db = require('../database').db;
        db.prepare("DELETE FROM db_object_types WHERE id = ?").run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/settings/erp-paths
router.get('/settings/erp-paths', verifyToken, checkAdmin, (req, res) => {
    try {
        const db = require('../database').db;
        const formBase = db.prepare("SELECT value FROM system_settings WHERE key = 'ERP_FORM_BASE_PATH'").get();
        const reportBase = db.prepare("SELECT value FROM system_settings WHERE key = 'ERP_REPORT_BASE_PATH'").get();
        const sqlBase = db.prepare("SELECT value FROM system_settings WHERE key = 'ERP_SQL_BASE_PATH'").get();
        const libraryBase = db.prepare("SELECT value FROM system_settings WHERE key = 'ERP_LIBRARY_BASE_PATH'").get();

        res.json({
            form_base: formBase ? formBase.value : '',
            report_base: reportBase ? reportBase.value : '',
            sql_base: sqlBase ? sqlBase.value : '',
            library_base: libraryBase ? libraryBase.value : ''
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/settings/erp-paths
router.post('/settings/erp-paths', verifyToken, checkAdmin, (req, res) => {
    const { form_base, report_base, sql_base, library_base } = req.body;
    try {
        const db = require('../database').db;
        db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ERP_FORM_BASE_PATH', ?)").run(form_base);
        db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ERP_REPORT_BASE_PATH', ?)").run(report_base);
        db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ERP_SQL_BASE_PATH', ?)").run(sql_base);
        db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ERP_LIBRARY_BASE_PATH', ?)").run(library_base);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



// POST /api/admin/sync-global
router.post('/sync-global', verifyToken, checkAdmin, async (req, res) => {
    try {
        const ProjectSyncService = require('../services/projectSyncService');
        const result = await ProjectSyncService.syncAllProjects();
        res.json({ success: true, count: result.count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Auto Backup Routes ---

const backupService = require('../services/backupService');

// Get Backup Config (Path & Schedule)
router.get('/backup/config', verifyToken, checkAdmin, (req, res) => {
    try {
        const path = backupService.getDisplayPath();
        const db = require('../database').db;
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'BACKUP_SCHEDULE'").get();
        // Default: Daily 02:00, enabled
        const schedule = row ? JSON.parse(row.value) : { frequency: 'daily', time: '02:00', enabled: true };

        res.json({ path, schedule });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Backup Schedule
router.post('/backup/config', verifyToken, checkAdmin, (req, res) => {
    try {
        const { frequency, time, enabled } = req.body;
        const db = require('../database').db;
        const schedule = { frequency, time, enabled: enabled === undefined ? true : enabled };

        db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('BACKUP_SCHEDULE', ?)").run(JSON.stringify(schedule));

        // Reload service
        backupService.reloadSchedule();

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// List Files
router.get('/backup/files', verifyToken, checkAdmin, (req, res) => {
    try {
        const files = backupService.listBackups();
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete File
// Download Backup File
router.get('/backup/download/:filename', verifyToken, checkAdmin, (req, res) => {
    const filename = req.params.filename;
    // Security check handled by service usually, but check here too
    if (filename.includes('..')) return res.status(400).json({ error: "Invalid filename" });

    const dir = backupService.getBackupPath();
    const filePath = path.join(dir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename);
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

router.delete('/backup/files/:filename', verifyToken, checkAdmin, (req, res) => {
    try {
        backupService.deleteBackup(req.params.filename);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Force Restore (From Backup List)
router.post('/backup/restore', verifyToken, checkAdmin, async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: "Filename required" });

        await backupService.restoreBackup(filename);
        res.json({ success: true, message: "Database restored successfully." });
    } catch (e) {
        console.error("Restore failed", e);
        res.status(500).json({ error: "Restore failed: " + e.message });
    }
});

// Trigger Manual Backup (Save to server path)
router.post('/backup/run', verifyToken, checkAdmin, (req, res) => {
    try {
        const result = backupService.performBackup('Manual Trigger');
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- DB Users Credential Management ---
const DB_USERS_CONFIG_PATH = path.join(__dirname, '../config/db_users.json');

// GET /api/admin/settings/db-users
// Allow all authenticated users to see available DB users for selection
router.get('/settings/db-users', verifyToken, (req, res) => {
    try {
        if (!fs.existsSync(DB_USERS_CONFIG_PATH)) {
            return res.json([]);
        }
        const data = fs.readFileSync(DB_USERS_CONFIG_PATH, 'utf8');
        const users = JSON.parse(data);
        // Mask passwords before sending to UI
        const safeUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            description: u.description,
            // Don't send password
        }));
        res.json(safeUsers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/admin/settings/db-users
router.post('/settings/db-users', verifyToken, checkAdmin, (req, res) => {
    try {
        const newUsers = req.body; // Expect array of user objects
        if (!Array.isArray(newUsers)) return res.status(400).json({ error: "Invalid data format" });

        // If updating, preserve passwords if not changed (UI should send empty password if unchanged)
        // Actually, UI usually sends full list.
        // Strategy:
        // 1. Read existing
        // 2. For each new user, if password provided -> update. If empty -> keep existing (if exists).

        let existingUsers = [];
        if (fs.existsSync(DB_USERS_CONFIG_PATH)) {
            existingUsers = JSON.parse(fs.readFileSync(DB_USERS_CONFIG_PATH, 'utf8'));
        }

        const mergedUsers = newUsers.map(u => {
            if (u.password) return u; // New password provided
            const existing = existingUsers.find(e => e.id === u.id);
            if (existing) {
                return { ...u, password: existing.password }; // Keep existing
            }
            // New user but no password? Invalid.
            return u;
        });

        // Ensure directory exists
        const dir = path.dirname(DB_USERS_CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(DB_USERS_CONFIG_PATH, JSON.stringify(mergedUsers, null, 2));
        res.json({ success: true, message: "DB Users updated" });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
