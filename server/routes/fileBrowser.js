const express = require('express');
const router = express.Router();
const Client = require('ssh2-sftp-client');
const archiver = require('archiver');
const path = require('path');
const { verifyToken } = require('./auth');

// Security: Protect ALL file browser routes
router.use(verifyToken);

// SFTP Config (Shared with deploy.js - normally would be central config)
const sftpConfig = {
    host: process.env.ERP_FTP_HOST || '10.8.91.171',
    port: parseInt(process.env.ERP_FTP_PORT) || 22,
    username: process.env.ERP_FTP_USERNAME || 't366mgr',
    password: process.env.ERP_FTP_PASSWORD || 'hk4g4'
};


// Helper to format date
const formatDate = (date) => {
    return new Date(date).toLocaleString('zh-TW', { hour12: false });
};

// POST /api/file-browser/list
// Body: { moduleId, type, subtype }
router.post('/list', async (req, res) => {
    let sftp = new Client();
    const { moduleId, type, subtype } = req.body; // type: 'Form', 'Report', 'SQL', 'Library'

    // Validate inputs
    if (!moduleId || !type) {
        return res.status(400).json({ success: false, error: 'Module and Type are required' });
    }

    try {
        const db = require('../database').db;

        // 1. Fetch Module Info
        const module = db.prepare('SELECT * FROM erp_modules WHERE id = ?').get(moduleId);
        if (!module) throw new Error('Module not found');

        const modulePathCode = (module.path_code || module.code).toLowerCase();

        // 2. Fetch System Settings
        const settings = db.prepare("SELECT key, value FROM system_settings WHERE key IN ('ERP_FORM_BASE_PATH', 'ERP_REPORT_BASE_PATH', 'ERP_SQL_BASE_PATH', 'ERP_LIBRARY_BASE_PATH')").all();
        const settingsMap = settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

        // 3. Resolve Path
        let basePath = '';
        if (type === 'Form') basePath = settingsMap['ERP_FORM_BASE_PATH'];
        else if (type === 'Report') basePath = settingsMap['ERP_REPORT_BASE_PATH'];
        else if (type === 'SQL') basePath = settingsMap['ERP_SQL_BASE_PATH'];
        else if (type === 'Library') basePath = settingsMap['ERP_LIBRARY_BASE_PATH'];

        if (!basePath) throw new Error(`Base path not configured for ${type}`);

        // Handle * wildcard first (if exists)
        if (basePath.includes('*')) {
            basePath = basePath.replace('*', modulePathCode);
        }

        let remotePath = basePath;

        // Special Logic for Form/fmx
        if (type === 'Form') {
            if (subtype === 'fmx') {
                // Rule: Change 'au' to module path code
                // Case insensitive replace for safety, assuming standard path structure
                // Use regex to replace '/au/' or similar boundaries to avoid replacing partial words
                // But user said "change au to module path code". 
                // Let's assume standard path like /u01/.../au/...

                // If path has /au/, replace the LAST occurrence or specific one? 
                // Usually it's like .../au/11.5.0/forms...
                // Let's do a simple replace.
                const auRegex = /\/au\//i;
                if (auRegex.test(remotePath)) {
                    remotePath = remotePath.replace(auRegex, `/${modulePathCode}/`);
                } else {
                    // What if no 'au'? Maybe it's not an AU path. 
                    // Log warning or just proceed?
                    console.warn(`[FileBrowser] Expected 'au' in path for fmx but found none: ${remotePath}`);
                }
            }
            // fmb uses the basePath (which is usually the au path)
        }

        console.log(`[FileBrowser] Listing files for Module: ${module.code}, Type: ${type}/${subtype || ''} -> Path: ${remotePath}`);

        await sftp.connect(sftpConfig);
        const fileList = await sftp.list(remotePath);
        await sftp.end();

        // Transform to friendly format
        const formattedList = fileList.map(item => ({
            name: item.name,
            type: item.type, // 'd' for directory, '-' for file, 'l' for link
            size: item.size,
            modifyTime: formatDate(item.modifyTime),
            rawModifyTime: item.modifyTime // For sorting if needed
        }));

        res.json({ success: true, files: formattedList, currentPath: remotePath });
    } catch (err) {
        if (sftp) {
            try { await sftp.end(); } catch (e) { }
        }
        console.error("SFTP List Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/file-browser/download
// Query: path=/remote/dir/&files=file1.txt,file2.txt (comma separated or repeated?)
// Let's use POST for download to handle array of files easier, but GET is better for browser direct download.
// If we use GET, we can pass `files` as JSON string or multiple params.
// Let's use GET with query params. type=single|multi
router.get('/download', async (req, res) => {
    let sftp = new Client();
    try {
        const remoteDir = req.query.path || '.';
        const filesParam = req.query.files; // Can be string or array

        if (!filesParam) {
            return res.status(400).send('No files specified');
        }

        // Security: Path Traversal Check
        if (remoteDir.includes('..')) {
            return res.status(403).send('Invalid path (Traversing detected)');
        }

        const files = Array.isArray(filesParam) ? filesParam : [filesParam];

        await sftp.connect(sftpConfig);

        if (files.length === 1) {
            // Single file download
            const filename = files[0];
            const remoteFilePath = path.posix.join(remoteDir, filename);

            // Check if exists
            const type = await sftp.exists(remoteFilePath);
            if (!type) {
                await sftp.end();
                return res.status(404).send('File not found');
            }

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Stream directly to response
            // sftp.get returns a Promise that resolves to Buffer if no dst is provided, 
            // OR if a stream is provided, it pipes to it.
            // ssh2-sftp-client .get(path, dst) where dst can be a stream.

            await sftp.get(remoteFilePath, res);
            await sftp.end();

        } else {
            // Multiple files - ZIP them
            const archive = archiver('zip', {
                zlib: { level: 9 } // Sets the compression level.
            });

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="download.zip"');

            archive.pipe(res);

            for (const file of files) {
                const remoteFilePath = path.posix.join(remoteDir, file);
                // We need to get the file buffer or stream and append to archive.
                // Since sftp.get can return a buffer, we can do that.
                // However, doing this sequentially might be slow for large files.
                // But sftp client might not support concurrent requests on same connection depending on implementation.
                // ssh2-sftp-client is based on ssh2.

                try {
                    const buffer = await sftp.get(remoteFilePath);
                    archive.append(buffer, { name: file });
                } catch (e) {
                    console.error(`Failed to download ${file} for zip:`, e);
                    // Decide whether to fail hard or skip.
                    // Appending a text file with error might be friendly.
                    archive.append(Buffer.from(`Error downloading ${file}: ${e.message}`), { name: `ERROR_${file}.txt` });
                }
            }

            await archive.finalize();
            await sftp.end();
        }

    } catch (err) {
        console.error("SFTP Download Error:", err);
        if (sftp) {
            try { await sftp.end(); } catch (e) { }
        }
        if (!res.headersSent) {
            res.status(500).send(`Download Error: ${err.message}`);
        }
    }
});

module.exports = router;
