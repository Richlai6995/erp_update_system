const express = require('express');
const router = express.Router();
const oracleService = require('../services/oracleService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('./auth');

// Configure Multer for Backup Uploads (Temporary storage)
const uploadDir = path.join(__dirname, '../../uploads/backups_temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use original name but ensure uniqueness if needed, or just overwrite?
        // Prompt says "produce a same object name .sql file".
        // Let's keep original name for manual upload.
        // Ensure encoded correctly.
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '_' + file.originalname);
    }
});

const upload = multer({ storage });

// Test Connection
router.get('/test', verifyToken, async (req, res) => {
    // Security: DBA/Admin only
    const isDBA = req.user.role === 'dba' || (req.user.role && req.user.role.includes('dba'));
    if (!isDBA && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const success = await oracleService.testConnection();
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto Backup (Fetch DDL)
router.post('/backup-ddl', verifyToken, async (req, res) => {
    // Allow all users to backup (required for application)
    // const isDBA = req.user.role === 'dba' || (req.user.role && req.user.role.includes('dba'));
    // if (!isDBA && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { schemaName, objectName, objectType } = req.body;
        if (!schemaName || !objectName || !objectType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const ddl = await oracleService.getDDL(schemaName, objectName, objectType);

        // Save to file
        const fileName = `${objectName}.sql`;
        const filePath = path.join(uploadDir, `${Date.now()}_${fileName}`);

        fs.writeFileSync(filePath, ddl);

        res.json({ success: true, filePath, fileName });
    } catch (error) {
        console.error("Auto Backup Failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// Manual Backup (Upload)
router.post('/manual-backup', verifyToken, upload.single('file'), (req, res) => {
    // Allow all users to upload backup
    // const isDBA = req.user.role === 'dba' || (req.user.role && req.user.role.includes('dba'));
    // if (!isDBA && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        res.json({ success: true, filePath: req.file.path, fileName: req.file.originalname });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download Backup (From Temp or Final path?)
router.get('/download', verifyToken, (req, res) => {
    // Allow all users to download backup
    // const isDBA = req.user.role === 'dba' || (req.user.role && req.user.role.includes('dba'));
    // if (!isDBA && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { filePath } = req.query;
        if (!filePath) return res.status(400).json({ error: 'Missing file path' });

        const absolutePath = path.resolve(filePath);
        const allowedTemp = path.resolve(uploadDir);

        if (!absolutePath.startsWith(allowedTemp) && !absolutePath.includes('uploads')) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Path Traversal Check
        if (filePath.includes('..')) return res.status(403).json({ error: 'Invalid path' });

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.download(absolutePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Backup (Temp)
router.post('/delete', verifyToken, (req, res) => {
    // Allow all users to delete temp backup
    // const isDBA = req.user.role === 'dba' || (req.user.role && req.user.role.includes('dba'));
    // if (!isDBA && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Missing file path' });

        // Security check: Strict Path Validation
        const absolutePath = path.resolve(filePath);
        const allowedTemp = path.resolve(uploadDir);

        if (!absolutePath.startsWith(allowedTemp)) {
            return res.status(403).json({ error: 'Access denied: Cannot delete files outside backup temp' });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
