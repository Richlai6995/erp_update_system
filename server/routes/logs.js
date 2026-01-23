const express = require('express');
const router = express.Router();
const dbExports = require('../database');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('./auth');

const LOG_DIR = path.join(process.cwd(), 'logs/terminals');

// Get logs for a specific request
router.get('/request/:requestId', verifyToken, async (req, res) => {
    try {
        const db = await dbExports.init();
        const logs = db.prepare(`
            SELECT * FROM connection_logs 
            WHERE application_id = ? 
            ORDER BY start_time DESC
        `).all(req.params.requestId);

        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get content of a specific log
router.get('/:logId/content', verifyToken, async (req, res) => {
    try {
        const db = await dbExports.init();
        const log = db.prepare('SELECT * FROM connection_logs WHERE id = ?').get(req.params.logId);

        if (!log) {
            return res.status(404).json({ error: 'Log not found' });
        }

        // Security check: Ensure user has permission? 
        // For now, assuming anyone with token can view logs (admins/managers/applicants)
        // Ideally verify user access to the application_id.

        const filePath = path.join(LOG_DIR, log.log_filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Log file not found on disk' });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        // Remove ANSI codes for cleaner display? Or keep them if frontend handles it?
        // Frontend handling (xterm or simple text) is better.
        // Let's strip ANSI controls for simple text viewing if requested, but raw is better for truth.
        res.send(content);

    } catch (error) {
        console.error('Error reading log content:', error);
        res.status(500).json({ error: 'Failed to read log content' });
    }
});

module.exports = router;
