const express = require('express');
const router = express.Router();
const Client = require('ssh2-sftp-client');
const path = require('path');
const db = require('../database');

const { verifyToken } = require('./auth');

// SFTP Config
const sftpConfig = {
    host: process.env.ERP_FTP_HOST || '10.8.91.171',
    port: parseInt(process.env.ERP_FTP_PORT) || 22,
    username: process.env.ERP_FTP_USERNAME || 't366mgr',
    password: process.env.ERP_FTP_PASSWORD || 'hk4g4'
};
// Mask password for logging
const logSafeConfig = { ...sftpConfig, password: '*****' };

// POST /api/deploy/:id
router.post('/:id', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    const logs = [];

    const log = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleString('zh-TW', { hour12: false });
        logs.push({ timestamp, message: msg, type });
        console.log(`[Deploy ${requestId}] ${msg}`);
    };

    // SECURITY: Role Check
    const isDBA = req.user.role === 'dba' || (req.user.role && req.user.role.includes('dba'));
    if (!isDBA && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized: Deployment is restricted to DBA or Admin.' });
    }

    let sftp = new Client();

    try {
        log('Starting deployment process...');

        // 1. Get Request Details
        const request = db.db.prepare(`
            SELECT r.*, m.code as module_code, m.path_code,
                   u.name as applicant_name, u.username as applicant_username
            FROM applications r
            LEFT JOIN users u ON r.applicant_id = u.id
            LEFT JOIN erp_modules m ON r.module_id = m.id
            WHERE r.id = ?
        `).get(requestId);

        if (!request) throw new Error('Request not found');

        // SECURITY: Status Check
        if (!['approved', 'online'].includes(request.status)) {
            return res.status(400).json({ success: false, error: 'Deployment allowed only for Approved requests.' });
        }

        log(`Request found: ${request.form_id} (Module: ${request.module_code}, Type: ${request.program_type})`);

        // 2. Fetch Global Path Settings
        // 2. Fetch Global Path Settings
        const settings = db.db.prepare("SELECT key, value FROM system_settings WHERE key IN ('ERP_FORM_BASE_PATH', 'ERP_REPORT_BASE_PATH', 'ERP_SQL_BASE_PATH', 'ERP_LIBRARY_BASE_PATH')").all();
        const settingsMap = settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

        const formBasePath = settingsMap['ERP_FORM_BASE_PATH'] || '';
        const reportBasePath = settingsMap['ERP_REPORT_BASE_PATH'] || '';
        const sqlBasePath = settingsMap['ERP_SQL_BASE_PATH'] || '';
        const libraryBasePath = settingsMap['ERP_LIBRARY_BASE_PATH'] || '';
        const pathCode = request.path_code ? request.path_code.toLowerCase() : (request.module_code ? request.module_code.toLowerCase() : '');

        // Helper to resolve path
        const resolvePath = (basePath, code) => {
            if (basePath && basePath.includes('*')) {
                return basePath.replace('*', code);
            }
            return basePath;
        };

        // 3. Determine Destination Path (Primary)
        let remoteDir = '';
        if (request.program_type === 'Form') {
            remoteDir = resolvePath(formBasePath, pathCode);
        } else if (request.program_type === 'Report') {
            remoteDir = resolvePath(reportBasePath, pathCode);
        } else if (request.program_type === 'SQL') {
            remoteDir = resolvePath(sqlBasePath, pathCode);
        } else if (request.program_type === 'Library') {
            remoteDir = resolvePath(libraryBasePath, pathCode);
        } else {
            if (!remoteDir) log('Warning: No specific path for this program type, checking file extensions...', 'warning');
        }

        // 4. Get Files
        const files = db.db.prepare('SELECT * FROM application_files WHERE application_id = ?').all(requestId);
        if (files.length === 0) {
            log('No files to upload.');
            return res.json({ success: true, logs });
        }

        log(`Found ${files.length} files to upload.`);

        // 5. Connect SFTP
        log(`Connecting to SFTP (${sftpConfig.host})...`);
        await sftp.connect(sftpConfig);
        log('SFTP Connected.');

        // 6. Upload Files
        for (const file of files) {
            // Check if file exists locally
            const sourcePath = file.file_path || path.join(__dirname, '../uploads', file.filename);

            // Determine remote path for THIS file
            let currentRemoteDir = remoteDir;
            const ext = path.extname(file.original_name).toLowerCase();

            // Fallback Logic by Extension (if program_type was generic or path not set)
            if (!currentRemoteDir) {
                if (ext === '.fmb') currentRemoteDir = resolvePath(formBasePath, pathCode);
                else if (ext === '.rdf' || ext === '.jsp') currentRemoteDir = resolvePath(reportBasePath, pathCode);
                else if (ext === '.sql') currentRemoteDir = resolvePath(sqlBasePath, pathCode);
                else if (ext === '.pll' || ext === '.plx') currentRemoteDir = resolvePath(libraryBasePath, pathCode);
            }

            if (!currentRemoteDir) {
                log(`Skipping ${file.original_name}: Could not determine remote path.`, 'error');
                continue;
            }

            const remoteFilePath = path.posix.join(currentRemoteDir, file.original_name);

            // --- BACKUP LOGIC ---
            // If remote file exists, rename it: OriginalName_BK_BY_FormID_ApplicantName.ext
            // e.g. FLASSIGN02_BK_BY_FL202601140003_RICH_LAI.fmb
            try {
                const exists = await sftp.exists(remoteFilePath);
                if (exists) {
                    const baseName = path.basename(file.original_name, ext);
                    const applicantUsername = request.applicant_username ? request.applicant_username.toUpperCase() : 'USER';

                    const backupName = `${baseName}_BK_BY_${request.form_id}_${applicantUsername}${ext}`;
                    const backupPath = path.posix.join(currentRemoteDir, backupName);

                    log(`File exists. Backing up to: ${backupName}`, 'warning');

                    // Check if backup file ALREADY exists
                    const backupExists = await sftp.exists(backupPath);
                    if (backupExists) {
                        // User Request: If backup exists, preserve it and just overwrite the main file.
                        log(`Backup file ${backupName} already exists. Skipping backup creation (Preserving existing backup).`, 'warning');
                    } else {
                        await sftp.rename(remoteFilePath, backupPath);
                    }
                }
            } catch (bkErr) {
                log(`Backup failed for ${file.original_name}: ${bkErr.message}`, 'error');
            }

            log(`Uploading ${file.original_name} -> ${remoteFilePath} ...`);

            try {
                await sftp.put(sourcePath, remoteFilePath);
                log(`Successfully uploaded ${file.original_name}`, 'success');

                // Update DB Status
                const now = new Date().toLocaleString('zh-TW', { hour12: false });
                db.db.prepare('UPDATE application_files SET deployed_at = ?, deploy_status = ? WHERE id = ?')
                    .run(now, 'success', file.id);

            } catch (uploadErr) {
                log(`Failed to upload ${file.original_name}: ${uploadErr.message}`, 'error');
                db.db.prepare('UPDATE application_files SET deploy_status = ? WHERE id = ?')
                    .run('failed', file.id);
            }
        }

        await sftp.end();
        log('Deployment finished.', 'success');

        res.json({ success: true, logs });

    } catch (err) {
        log(`Deployment Error: ${err.message}`, 'error');
        if (sftp) {
            try { await sftp.end(); } catch (e) { /* ignore */ }
        }
        res.status(500).json({ success: false, logs, error: err.message });
    }
});

module.exports = router;
