const express = require('express');
const router = express.Router();
const mailService = require('../services/mailService');
const dbWrapper = require('../database');
const { verifyToken } = require('./auth');

// Security: Protect ALL mail routes
router.use(verifyToken);

// Send Email
router.post('/send', async (req, res) => {
    try {
        const { from, to, cc, subject, html, executor, fileName, projectName, pathInfo } = req.body;

        // Simple validation
        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'Missing required fields (to, subject, html)' });
        }

        // Call service
        const result = await mailService.sendEmail({
            from,
            to,
            cc,
            subject,
            html,
            executor: executor || 'Unknown',
            fileName: fileName || 'Untitled',
            projectName: projectName || '',
            pathInfo: pathInfo || ''
        });

        res.json({ success: true, message: 'Email sent successfully', result });
    } catch (error) {
        console.error('Mail send error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Logs
router.get('/logs', async (req, res) => {
    try {
        const db = await dbWrapper.init();
        const logs = db.prepare("SELECT * FROM mail_logs ORDER BY created_at DESC LIMIT 100").all();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Logs by Schedule ID
router.get('/logs/schedule/:scheduleId', async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const db = await dbWrapper.init();
        const logs = db.prepare("SELECT * FROM mail_logs WHERE schedule_id = ? ORDER BY created_at DESC").all(scheduleId);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Server Status
router.get('/status', async (req, res) => {
    try {
        const db = await dbWrapper.init();
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'mail_server_enabled'").get();
        const isEnabled = row ? row.value === 'true' : true; // Default true
        res.json({ enabled: isEnabled });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle Server
router.post('/toggle', async (req, res) => {
    try {
        const { enabled } = req.body; // boolean
        const val = enabled ? 'true' : 'false';
        const db = await dbWrapper.init();

        // Upsert
        const existing = db.prepare("SELECT key FROM system_settings WHERE key = 'mail_server_enabled'").get();
        if (existing) {
            db.prepare("UPDATE system_settings SET value = ? WHERE key = 'mail_server_enabled'").run(val);
        } else {
            db.prepare("INSERT INTO system_settings (key, value) VALUES ('mail_server_enabled', ?)").run(val);
        }

        res.json({ success: true, enabled });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logs Maintenance
router.get('/settings/retention', async (req, res) => {
    try {
        const days = await mailService.getRetentionDays();
        res.json({ days });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/settings/retention', async (req, res) => {
    try {
        const { days } = req.body;
        if (days === undefined || days === null) return res.status(400).json({ error: 'Missing days' });
        await mailService.setRetentionDays(parseInt(days));

        // Auto-trigger cleanup immediately so user sees effect
        await mailService.cleanupOldLogs();

        res.json({ success: true, days });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/logs', async (req, res) => {
    try {
        const { beforeDate } = req.body; // YYYY-MM-DD or null
        const count = await mailService.clearLogs(beforeDate);
        res.json({ success: true, deleted: count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/logs/export', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const csv = await mailService.exportLogs(startDate, endDate);

        const filename = `mail_logs_${startDate || 'all'}_to_${endDate || 'now'}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
