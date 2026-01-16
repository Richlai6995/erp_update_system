const express = require('express');
const router = express.Router();
const { Client } = require('ssh2');
const path = require('path');
const db = require('../database');

const { verifyToken } = require('./auth');

// POST /api/compile/:id
router.post('/:id', verifyToken, async (req, res) => {
    const requestId = req.params.id;
    const logs = [];

    const log = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleString('zh-TW', { hour12: false });
        logs.push({ timestamp, message: msg, type });
        console.log(`[Compile ${requestId}] ${msg}`);
    };

    const conn = new Client();

    try {
        log('Initializing compilation process...');

        // 1. Get Request Details
        const request = db.db.prepare(`
            SELECT r.*, m.code as module_code, m.path_code
            FROM applications r
            LEFT JOIN erp_modules m ON r.module_id = m.id
            WHERE r.id = ?
        `).get(requestId);

        if (!request) throw new Error('Request not found');

        // SECURITY: Ownership Check
        console.log(`[Compile Debug] User: ${req.user.id}, Role: ${req.user.role}, Applicant: ${request.applicant_id}`);
        // Allow applicant or admin/dba to compile.
        if (request.applicant_id !== req.user.id && !['admin', 'dba'].includes(req.user.role)) {
            console.log(`[Compile Debug] Permission Denied`);
            return res.status(403).json({ success: false, error: 'Unauthorized: You can only compile your own requests.' });
        }

        if (request.program_type !== 'Form' && request.program_type !== 'Library') {
            return res.status(400).json({ success: false, logs, error: 'Only Form or Library types can be compiled.' });
        }

        // 2. Resolve Paths
        // Source: ERP_FORM_BASE_PATH (Standard AU path)
        const settings = db.db.prepare("SELECT key, value FROM system_settings WHERE key = 'ERP_FORM_BASE_PATH'").get();
        const baseFormPath = settings ? settings.value : '';

        if (!baseFormPath) throw new Error('ERP_FORM_BASE_PATH not configured in system settings.');

        // Target: Module Path (Replace 'au' with module code)
        const moduleCode = request.path_code ? request.path_code.toLowerCase() : request.module_code.toLowerCase();

        let targetPath = baseFormPath.replace('/au/', `/${moduleCode}/`);
        if (targetPath === baseFormPath && moduleCode !== 'au') {
            log(`Warning: Could not replace '/au/' in base path to generate target path. Target path might be incorrect (same as source).`, 'warning');
        }

        log(`Source Path (AU): ${baseFormPath}`);
        log(`Target Path (${moduleCode.toUpperCase()}): ${targetPath}`);

        // 3. Get Files
        const files = db.db.prepare('SELECT * FROM application_files WHERE application_id = ?').all(requestId);
        // Filter based on Type
        let targetFiles = [];
        if (request.program_type === 'Form') {
            targetFiles = files.filter(f => f.original_name.toLowerCase().endsWith('.fmb'));
        } else if (request.program_type === 'Library') {
            targetFiles = files.filter(f => f.original_name.toLowerCase().endsWith('.pll'));
        }

        if (targetFiles.length === 0) {
            log(`No compilable files (.fmb/.pll) found for type ${request.program_type}.`);
            return res.json({ success: true, logs });
        }

        // 4. SSH Config
        const sshConfig = {
            host: process.env.ERP_SSH_HOST,
            port: parseInt(process.env.ERP_SSH_PORT) || 22,
            username: process.env.ERP_SSH_USERNAME,
            password: process.env.ERP_SSH_PASSWORD
        };

        if (!sshConfig.host || !sshConfig.username || !sshConfig.password) {
            throw new Error('Missing SSH credentials in .env (ERP_SSH_HOST, ERP_SSH_USERNAME, ERP_SSH_PASSWORD)');
        }

        const compileUser = process.env.ERP_COMPILE_USER;
        const compilePwd = process.env.ERP_COMPILE_PASSWORD;

        if (!compileUser || !compilePwd) throw new Error('ERP_COMPILE_USER/PASSWORD not set.');

        if (!compileUser || !compilePwd) throw new Error('ERP_COMPILE_USER/PASSWORD not set.');

        log(`Connecting to SSH (${sshConfig.host})...`);

        await new Promise((resolve, reject) => {
            conn.on('ready', () => {
                log('SSH Connected.');

                let promiseChain = Promise.resolve();

                targetFiles.forEach(file => {
                    promiseChain = promiseChain.then(async () => {
                        const fileName = file.original_name;
                        const isLibrary = request.program_type === 'Library';

                        log(`-----------------------------------------------`);
                        log(`Processing ${fileName} (${isLibrary ? 'Library' : 'Form'})...`);

                        // SECURITY: Sanitize fileName to prevent Command Injection
                        if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
                            throw new Error(`Invalid filename detected (security check): ${fileName}`);
                        }

                        // Step 1: Execute Compile Command
                        // Fix: Source user profile to ensure environment variables are loaded
                        // For Form: Use baseFormPath
                        // For Library: Use $AU_TOP/resource (as per user instruction)

                        let compileCmd = '';
                        if (isLibrary) {
                            compileCmd = `source ~/.bash_profile; cd $AU_TOP/resource && frmcmp_batch module=${fileName} userid=${compileUser}/${compilePwd} module_type=library compile_all=special`;
                        } else {
                            // Form
                            compileCmd = `source ~/.bash_profile; cd ${baseFormPath} && frmcmp_batch module=${fileName} userid=${compileUser}/${compilePwd} batch=yes`;
                        }

                        log(`[Step 1] Switching to directory and compiling...`);
                        const maskedCompileCmd = compileCmd.replace(new RegExp(compilePwd, 'g'), '*****');
                        log(`Command: ${maskedCompileCmd}`);

                        try {
                            const compileOutput = await executeCommand(conn, compileCmd, log);
                        } catch (e) {
                            log(`Compile Command Error: ${e.message}`, 'error');
                        }

                        // Step 2: Verification and Move (Form Only)
                        // If Library, we just assume success if no error? 
                        // Or check for .plx? User said "compile完畢後即" (Done after compile), no move needed.
                        // We will check for .plx existence to verify success for Library too.

                        let success = false;

                        if (isLibrary) {
                            const baseName = path.basename(fileName, '.pll');
                            const plxName = baseName + '.plx';
                            log(`[Step 2] Verifying artifact ${plxName}...`);

                            // Check if PLX exists in $AU_TOP/resource
                            const checkPlxCmd = `source ~/.bash_profile; if [ -f "$AU_TOP/resource/${plxName}" ]; then echo "COMPILE_SUCCESS"; else echo "PLX_NOT_FOUND"; fi`;
                            const checkResult = await executeCommand(conn, checkPlxCmd, log);

                            if (checkResult && checkResult.includes('COMPILE_SUCCESS')) {
                                success = true;
                                log(`SUCCESS: ${plxName} generated successfully.`, 'success');
                            } else {
                                log(`FAILURE: ${plxName} was not generated.`, 'error');
                                // Try to read .err
                                const errFile = `$AU_TOP/resource/${baseName}.err`;
                                const catErrCmd = `source ~/.bash_profile; if [ -f "${errFile}" ]; then cat "${errFile}"; fi`;
                                log(`Attempting to read error log: ${baseName}.err`);
                                await executeCommand(conn, catErrCmd, log);
                            }

                        } else {
                            // Form Logic (Existing)
                            const baseName = path.basename(fileName, '.fmb');
                            const fmxName = baseName + '.fmx';
                            log(`[Step 2] Verifying and moving artifact ${fmxName}...`);

                            const sourceFmx = `${baseFormPath}/${fmxName}`;
                            // Moving to targetPath (calculated above)
                            const checkAndMoveCmd = `if [ -f "${sourceFmx}" ]; then mv -f "${sourceFmx}" "${targetPath}"; echo "MOVE_SUCCESS"; else echo "FMX_NOT_FOUND"; fi`;

                            const moveResult = await executeCommand(conn, checkAndMoveCmd, log);
                            if (moveResult && moveResult.includes('MOVE_SUCCESS')) {
                                success = true;
                                log(`SUCCESS: ${fmxName} generated and moved to module path.`, 'success');
                            } else {
                                log(`FAILURE: ${fmxName} was not generated.`, 'error');
                                const errFile = `${baseFormPath}/${baseName}.err`;
                                const catErrCmd = `if [ -f "${errFile}" ]; then cat "${errFile}"; fi`;
                                log(`Attempting to read error log: ${baseName}.err`);
                                await executeCommand(conn, catErrCmd, log);
                            }
                        }

                        if (success) {
                            // Update DB Status
                            try {
                                const nowStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
                                db.db.prepare("UPDATE application_files SET compiled_at = ?, compile_status = 'success' WHERE id = ?").run(nowStr, file.id);
                            } catch (dbe) {
                                log(`DB Update Failed: ${dbe.message}`, 'warning');
                            }
                        } else {
                            // Mark as failed? Or just leave it?
                            // Maybe we should update compile_status = 'failed'
                            try {
                                db.db.prepare("UPDATE application_files SET compile_status = 'failed' WHERE id = ?").run(file.id);
                            } catch (e) { }
                            throw new Error(`Compilation failed for ${fileName}`);
                        }
                    });
                });

                promiseChain.then(() => {
                    conn.end();
                    resolve();
                }).catch(err => {
                    conn.end();
                    reject(err);
                });

            }).on('error', (err) => {
                reject(err);
            }).connect(sshConfig);
        });

        log('All compilation tasks finished.', 'success');
        res.json({ success: true, logs });

    } catch (err) {
        log(`Compilation Error: ${err.message}`, 'error');
        res.status(500).json({ success: false, logs, error: err.message });
    }
});

function executeCommand(conn, cmd, log) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('close', (code, signal) => {
                resolve(output);
            }).on('data', (data) => {
                const s = data.toString().trim();
                if (s) { log(`STDOUT: ${s}`); output += s + '\n'; }
            }).stderr.on('data', (data) => {
                const s = data.toString().trim();
                if (s) { log(`STDERR: ${s}`, 'warning'); }
            });
        });
    });
}

module.exports = router;
