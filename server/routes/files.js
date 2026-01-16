const express = require('express');
const router = express.Router();
const multer = require('multer');

const { verifyToken } = require('./auth');
const driveService = require('../services/driveService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit per file
});

router.use(verifyToken);

// Helper for permission checking
const checkPermission = (db, userId, userRole, projectId, action) => {
    // 1. Admin Bypass (Super User)
    if (userRole === 'admin') return { allowed: true };

    // 2. Project Manager Bypass
    const project = db.prepare('SELECT manager_id, end_date FROM projects WHERE id = ?').get(projectId);
    if (!project) return { allowed: false, error: 'Project not found' };
    if (project.manager_id === userId) return { allowed: true };

    // 3. Expiration Check (For Members)
    // Only enforces on modification actions (upload, delete, edit) AND download
    if (['upload', 'delete', 'edit', 'download'].includes(action)) {
        if (project.end_date) {
            const today = new Date().toISOString().split('T')[0];
            if (project.end_date < today) {
                // Expired
                return { allowed: false, error: '專案已過期，無法操作' };
            }
        }
    }

    // 4. Member Permission Check
    const member = db.prepare('SELECT permissions FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
    if (!member) return { allowed: false, error: '無權限 (NotInProject)' };

    try {
        const perms = JSON.parse(member.permissions || '{}');
        if (perms[action]) return { allowed: true };
        return { allowed: false, error: '權限不足' };
    } catch (e) { return { allowed: false, error: '權限解析失敗' }; }
};

// LIST Files for Project
router.get('/project/:projectId', (req, res) => {
    const { projectId } = req.params;
    const { folderId } = req.query; // Support filtering by folder
    const db = require('../database').db;

    const perm = checkPermission(db, req.user.id, req.user.role, projectId, 'view');
    if (!perm.allowed) {
        return res.status(403).json({ error: perm.error || '無權限檢視此專案檔案' });
    }

    try {
        let sql = `
            SELECT f.*, u.name as uploader_name 
            FROM files f
            LEFT JOIN users u ON f.uploader_id = u.id
            WHERE f.project_id = ?
        `;
        const params = [projectId];

        if (req.query.all === 'true') {
            // No folder_id filter - fetch all for project
        } else if (folderId && folderId !== 'null' && folderId !== 'undefined') {
            sql += ' AND f.folder_id = ?';
            params.push(folderId);
        } else {
            sql += ' AND f.folder_id IS NULL'; // Root files
        }

        sql += ' ORDER BY f.updated_at DESC';

        const files = db.prepare(sql).all(...params);
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// UPLOAD File
router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { projectId, description, folderId } = req.body;

    if (!projectId) return res.status(400).json({ error: 'Project ID required' });
    const db = require('../database').db;

    const perm = checkPermission(db, req.user.id, req.user.role, projectId, 'upload');
    if (!perm.allowed) {
        return res.status(403).json({ error: perm.error || '無權限上傳檔案至此專案' });
    }

    try {
        // 1. Get Project/Folder Drive ID
        let parentDriveId;
        if (folderId) {
            const folder = db.prepare('SELECT drive_folder_id FROM folders WHERE id = ?').get(folderId);
            if (folder) parentDriveId = folder.drive_folder_id;
        }

        if (!parentDriveId) {
            const project = db.prepare('SELECT drive_folder_id FROM projects WHERE id = ?').get(projectId);
            if (project) parentDriveId = project.drive_folder_id;
        }

        // 2. Upload to Drive (via GAS)
        const base64Content = req.file.buffer.toString('base64');
        let driveFileId;

        try {
            driveFileId = await driveService.uploadFile(
                base64Content,
                req.file.originalname,
                req.file.mimetype,
                parentDriveId || 'root'
            );
        } catch (e) {
            console.error('Drive upload failed, using placeholder', e);
            driveFileId = `failed_upload_${Date.now()}`;
        }

        // 3. Save to DB
        // Check if file exists (versioning)
        const existingFile = db.prepare('SELECT id, current_version FROM files WHERE project_id = ? AND filename = ?').get(projectId, req.file.originalname);

        let fileId;
        if (existingFile) {
            // Versioning
            const newVersion = existingFile.current_version + 1;

            // Insert current state into versions history
            db.prepare(`
                INSERT INTO file_versions (file_id, version, drive_file_id, uploader_id)
                SELECT id, current_version, drive_file_id, uploader_id FROM files WHERE id = ?
            `).run(existingFile.id);

            // Update main file
            db.prepare(`
                UPDATE files 
                SET drive_file_id = ?, current_version = ?, size = ?, updated_at = CURRENT_TIMESTAMP, uploader_id = ?
                WHERE id = ?
            `).run(driveFileId, newVersion, req.file.size, req.user.id, existingFile.id);

            fileId = existingFile.id;
        } else {
            // New File
            const result = db.prepare(`
                INSERT INTO files (project_id, folder_id, filename, drive_file_id, uploader_id, mime_type, size, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(projectId, folderId || null, req.file.originalname, driveFileId, req.user.id, req.file.mimetype, req.file.size, description);
            fileId = result.lastInsertRowid;
        }

        res.json({ success: true, fileId: fileId });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DOWNLOAD File (Direct Path - used for AI generated files)
router.get('/download', (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });

    // Security Check: Only allow downloads from 'AI_Generated' or 'uploads' context
    // Ideally use real path checks. For now, trusting internal generation if token is valid.
    // Security Check: Prevent Path Traversal
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.resolve(filePath);

    const allowedRoots = [
        path.resolve(process.env.FILES_ROOT_DIR || path.join(__dirname, '..', 'local_storage')),
        path.resolve(__dirname, '..', 'uploads'),
        path.resolve(__dirname, '..', 'temp_context')
    ];

    const isAllowed = allowedRoots.some(root => resolvedPath.startsWith(root));

    if (!isAllowed) {
        console.warn(`[Security] Blocked access to restricted path: ${resolvedPath}`);
        return res.status(403).json({ error: 'Access denied: Invalid file path' });
    }

    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File not found on server' });
    }

    // Set filename properly
    const fileName = require('path').basename(filePath);
    res.download(filePath, fileName, (err) => {
        if (err) {
            if (!res.headersSent) {
                res.status(500).send("Download failed");
            }
        }
    });
});

// DOWNLOAD File (Redirect or Return URL)
router.get('/:id/download', async (req, res) => {
    const { id } = req.params;
    const db = require('../database').db;

    try {
        const file = db.prepare('SELECT project_id, drive_file_id FROM files WHERE id = ?').get(id);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const perm = checkPermission(db, req.user.id, req.user.role, file.project_id, 'download');
        if (!perm.allowed) {
            return res.status(403).json({ error: perm.error || '無權限下載此檔案' });
        }

        // Construct Local Download
        // file.drive_file_id now holds the relative path
        const fs = require('fs');
        const path = require('path');
        const FILES_ROOT = process.env.FILES_ROOT_DIR || path.join(__dirname, '..', 'local_storage');

        let filePath = file.drive_file_id;
        // If it looks like a Drive ID (no slashes, long string), it might be legacy or error.
        // But for new system, we treat it as path. 
        // We need to resolve it against ROOT.
        const absolutePath = path.join(FILES_ROOT, filePath);

        if (fs.existsSync(absolutePath)) {
            res.download(absolutePath, file.filename);
        } else {
            // Fallback for legacy Drive files? 
            // If we are strictly migrating, maybe we assume it's local. 
            // But if we didn't migrate old files, they are broken.
            // implementation_plan says "Migration of existing files ... is not covered". 
            // So we focus on NEW files or assume manual migration.
            res.status(404).json({ error: 'File not found locally' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE File
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const db = require('../database').db;

    try {
        const file = db.prepare('SELECT project_id, drive_file_id FROM files WHERE id = ?').get(id);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const perm = checkPermission(db, req.user.id, req.user.role, file.project_id, 'delete');
        if (!perm.allowed) {
            return res.status(403).json({ error: perm.error || '無權限刪除此檔案' });
        }

        // Delete from Drive
        if (file.drive_file_id) {
            try {
                await driveService.deleteFile(file.drive_file_id);
            } catch (driveErr) {
                console.warn("Failed to delete from Drive, but proceeding with DB delete", driveErr);
            }
        }

        // Delete from DB (Soft or Hard? Hard for now)
        db.prepare('DELETE FROM file_versions WHERE file_id = ?').run(id);
        db.prepare('DELETE FROM files WHERE id = ?').run(id);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// BATCH DELETE Files
router.post('/batch-delete', async (req, res) => {
    const { fileIds } = req.body;
    const db = require('../database').db;

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: "Invalid file list" });
    }

    let successCount = 0;
    let errors = [];

    // Verify permissions for project of the first file (Assuming batch delete is within a project context usually)
    // Or verify per file. Let's verify per file to be safe, or group by project.
    // Simplifying: iterating and checking.

    for (const id of fileIds) {
        try {
            const file = db.prepare('SELECT project_id, drive_file_id FROM files WHERE id = ?').get(id);
            if (!file) {
                errors.push(`File ${id} not found`);
                continue;
            }

            // Check permission (Optimization: could check once per project if sorted)
            const perm = checkPermission(db, req.user.id, req.user.role, file.project_id, 'delete');
            if (!perm.allowed) {
                errors.push(`No permission/Expired for file ${id}: ${perm.error}`);
                continue;
            }

            // Delete from Drive / Local FS
            if (file.drive_file_id) {
                try {
                    await driveService.deleteFile(file.drive_file_id);
                } catch (driveErr) {
                    console.warn(`[Batch] Failed to delete FS file ${file.drive_file_id}`, driveErr);
                }
            }

            // Delete from DB
            db.prepare('DELETE FROM file_versions WHERE file_id = ?').run(id);
            db.prepare('DELETE FROM files WHERE id = ?').run(id);
            successCount++;

        } catch (e) {
            console.error(`[Batch] Error deleting file ${id}`, e);
            errors.push(`Error deleting file ${id}`);
        }
    }

    res.json({ success: true, deleted: successCount, errors: errors.length > 0 ? errors : undefined });
});

module.exports = router;
