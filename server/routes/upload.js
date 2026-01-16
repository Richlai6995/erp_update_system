const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('./auth');
const dbExports = require('../database');

// Configure Multer with Centralized Storage
const FILES_DIR = process.env.FILES_DIR || path.join(__dirname, '../uploads');

// Ensure directory exists
if (!fs.existsSync(FILES_DIR)) {
    try {
        fs.mkdirSync(FILES_DIR, { recursive: true });
    } catch (e) {
        console.error("Failed to create upload directory:", FILES_DIR, e);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, FILES_DIR);
    },
    filename: (req, file, cb) => {
        // Safe filename: Date + Original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        // Safe Extensions Whitelist
        const allowedExtensions = [
            '.sql', '.fmb', '.fmx', '.rdf', '.pll',
            '.java', '.class', '.jar', '.xml', '.json',
            '.zip', '.rar', '.7z',
            '.txt', '.log', '.csv',
            '.doc', '.docx', '.xls', '.xlsx', '.pdf',
            '.png', '.jpg', '.jpeg', '.gif'
        ];
        // Handle encoded Chinese names potentially? Multer handles originalname usually
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed: ${ext}`));
        }
    }
});

// Upload Files for an Application
router.post('/:applicationId', verifyToken, (req, res) => {
    upload.array('files')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: 'Upload Error: ' + err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        const { applicationId } = req.params;
        const { descriptions, dbObjectTypes, fileVersions, dbObjectNames, dbSchemaNames, isBackups, backupFilePaths } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { db } = dbExports;

        try {
            // SECURITY: LOCK FILE UPLOAD IF NOT DRAFT
            const app = db.prepare('SELECT status, applicant_id FROM applications WHERE id = ?').get(applicationId);
            if (!app) return res.status(404).json({ error: 'Application not found' });

            // Allow admin to bypass? Or strictly lock? 
            // Usually unlocked if rejected.
            if (!['draft', 'manager_rejected', 'dba_rejected'].includes(app.status)) {
                return res.status(403).json({ error: 'Cannot upload files to non-draft requests' });
            }
            // Ownership check
            if (app.applicant_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const results = [];
            const descArray = Array.isArray(descriptions) ? descriptions : [descriptions];
            const dbTypesArray = Array.isArray(dbObjectTypes) ? dbObjectTypes : [dbObjectTypes];
            const fileVersionsArray = Array.isArray(fileVersions) ? fileVersions : [fileVersions];

            const dbNamesArray = Array.isArray(dbObjectNames) ? dbObjectNames : [dbObjectNames];
            const schemaNamesArray = Array.isArray(dbSchemaNames) ? dbSchemaNames : [dbSchemaNames];
            const isBackupsArray = Array.isArray(isBackups) ? isBackups : [isBackups];
            const backupPathsArray = Array.isArray(backupFilePaths) ? backupFilePaths : [backupFilePaths];

            // 0. Pre-Check for Duplicates (Strict Block)
            const newNames = req.files.map(f => {
                try {
                    return Buffer.from(f.originalname, 'latin1').toString('utf8');
                } catch (e) { return f.originalname; }
            });

            // SQLite doesn't support array IN nicely with bind for dynamic length easily without helper, 
            // but we can iterate or build query. 
            // Simple iteration check since usually file count is small.
            const duplicates = [];
            for (const name of newNames) {
                const count = db.prepare('SELECT count(*) as c FROM application_files WHERE application_id = ? AND original_name = ?').get(applicationId, name);
                if (count.c > 0) duplicates.push(name);
            }

            if (duplicates.length > 0) {
                // Cleanup uploaded files
                req.files.forEach(f => {
                    try { fs.unlinkSync(f.path); } catch (e) { }
                });
                return res.status(400).json({ error: `Upload Failed: filenames already exist: ${duplicates.join(', ')}` });
            }

            req.files.forEach((file, index) => {
                const desc = descArray[index] || '';
                const dbType = dbTypesArray[index] || null;
                const fileVer = fileVersionsArray[index] || 'new'; // 'new' or 'update'

                const dbName = dbNamesArray[index] || '';
                const schemaName = schemaNamesArray[index] || '';
                const isBackupVal = (isBackupsArray[index] === 'true' || isBackupsArray[index] === true) ? 1 : 0;
                const tempBackupPath = backupPathsArray[index] || '';

                // Handle Backup File Move (Temp -> Perm)
                let finalBackupPath = '';
                if (tempBackupPath && fs.existsSync(tempBackupPath)) {
                    const backupFileName = path.basename(tempBackupPath);
                    const destPath = path.join(FILES_DIR, `backup_${backupFileName}`);
                    try {
                        fs.copyFileSync(tempBackupPath, destPath);
                        finalBackupPath = destPath;
                    } catch (err) {
                        console.error("Failed to move backup file:", err);
                    }
                }

                // Fix encoded filename
                let fixedOriginalName = file.originalname;
                try {
                    fixedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                } catch (e) { }

                const backupAt = isBackupVal ? new Date().toISOString() : null;

                // Insert New (Duplicates are blocked above)
                const info = db.prepare(`
                    INSERT INTO application_files (
                        application_id, filename, original_name, file_path, description, 
                        db_object_type, file_version, db_object_name, db_schema_name, 
                        is_backup, backup_file_path, backup_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    applicationId, file.filename, fixedOriginalName, file.path, desc,
                    dbType, fileVer, dbName, schemaName,
                    isBackupVal, finalBackupPath, backupAt
                );

                results.push({
                    id: info.lastInsertRowid,
                    filename: file.filename,
                    original_name: fixedOriginalName,
                    description: desc,
                    db_object_type: dbType,
                    file_version: fileVer,
                    version_type: fileVer,
                    db_object_name: dbName,
                    db_schema_name: schemaName,
                    is_backup: isBackupVal,
                    backup_file_path: finalBackupPath,
                    backup_at: backupAt
                });
            });

            res.json({ success: true, files: results });
        } catch (error) {
            console.error('File upload error:', error);
            // Cleanup files if DB error
            if (req.files) {
                req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) { } });
            }
            res.status(500).json({ error: 'Database error during file save' });
        }
    });
});

// Helper: Check Download Permission
const checkDownloadPermission = (db, user, fileId) => {
    // 1. Get File, Application & Applicant Info
    const file = db.prepare(`
        SELECT f.*, a.applicant_id, a.status, u.department as applicant_department
        FROM application_files f
        JOIN applications a ON f.application_id = a.id
        LEFT JOIN users u ON a.applicant_id = u.id
        WHERE f.id = ?
    `).get(fileId);

    if (!file) return { allowed: false, error: 'File not found' };

    // 2. Admin & DBA always allowed
    if (user.role === 'admin' || (user.role && user.role.includes('dba'))) return { allowed: true, file };

    // 3. Status 'online' -> Open to ALL authenticated users
    if (file.status === 'online') return { allowed: true, file };

    // 4. Owner & Same Department allowed (Department Sharing)
    if (file.applicant_id === user.id) return { allowed: true, file };
    if (file.applicant_department && file.applicant_department === user.department) return { allowed: true, file };

    // 5. Managers allowed (Reviewers)
    if (user.role === 'manager') return { allowed: true, file };

    return { allowed: false, error: 'Permission denied: Private file or different department' };
};

// Download File
router.get('/:fileId/download', verifyToken, (req, res) => {
    const { fileId } = req.params;
    const { db } = dbExports;

    try {
        const { allowed, file, error } = checkDownloadPermission(db, req.user, fileId);

        if (!allowed) {
            return res.status(403).json({ error: error });
        }

        // Use stored file_path if absolute, else join with FILES_DIR if strictly relative?
        // Current upload saves `file.path` from Multer which is absolute usually.
        // But if we moved files_dir, old paths might break. 
        // We should blindly trust DB path OR attempt to resolve.
        // Implementation: Try DB path first.
        let targetPath = file.file_path;

        if (!fs.existsSync(targetPath)) {
            // Fallback: try FILES_DIR + filename
            targetPath = path.join(FILES_DIR, file.filename);
        }

        // Security: Path Traversal Check
        if (targetPath.includes('..')) {
            return res.status(403).json({ error: 'Invalid file path' });
        }

        if (fs.existsSync(targetPath)) {
            // Force download with original name
            // Use res.download(path, filename)
            // Encode filename for headers? Express handles mostly.
            // Problem with Chinese filenames in headers sometimes.
            res.download(targetPath, file.original_name);
        } else {
            res.status(404).json({ error: 'File physical path not found' });
        }

    } catch (e) {
        console.error("Download Error:", e);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Download Backup File
router.get('/:fileId/download-backup', verifyToken, (req, res) => {
    const { fileId } = req.params;
    const { db } = dbExports;

    try {
        const { allowed, file, error } = checkDownloadPermission(db, req.user, fileId);

        if (!allowed) {
            return res.status(403).json({ error: error });
        }

        if (!file.backup_file_path) {
            return res.status(404).json({ error: 'No backup file attached' });
        }

        let targetPath = file.backup_file_path;

        if (!fs.existsSync(targetPath)) {
            // Fallback logic if needed, but backup path is usually absolute
        }

        if (targetPath.includes('..')) {
            return res.status(403).json({ error: 'Invalid file path' });
        }

        if (fs.existsSync(targetPath)) {
            const backupName = `backup_${file.db_object_name || 'object'}.sql`;
            res.download(targetPath, backupName);
        } else {
            res.status(404).json({ error: 'Backup file physical path not found' });
        }

    } catch (e) {
        console.error("Backup Download Error:", e);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Delete File
router.delete('/:fileId', verifyToken, (req, res) => {
    const { fileId } = req.params;
    const { db } = dbExports;

    try {
        const file = db.prepare('SELECT * FROM application_files WHERE id = ?').get(fileId);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const app = db.prepare('SELECT applicant_id, status FROM applications WHERE id = ?').get(file.application_id);
        // Ownership Check
        if (req.user.role !== 'admin' && app && app.applicant_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to delete this file' });
        }

        // SECURITY: LOCK FILE DELETION IF NOT DRAFT
        if (app && !['draft', 'manager_rejected', 'dba_rejected'].includes(app.status)) {
            return res.status(403).json({ error: 'Cannot delete files from non-draft requests' });
        }

        if (fs.existsSync(file.file_path)) {
            try {
                fs.unlinkSync(file.file_path);
            } catch (e) {
                console.warn("Failed to delete file from disk:", e);
            }
        }

        db.prepare('DELETE FROM application_files WHERE id = ?').run(fileId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

module.exports = router;
