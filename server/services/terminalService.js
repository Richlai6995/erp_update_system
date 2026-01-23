const pty = require('node-pty');
const path = require('path');
const fs = require('fs');
const dbWrapper = require('../database');
require('dotenv').config();

const DB_USERS_FILE = path.join(__dirname, '../config/db_users.json');
// Fix: Use process.cwd() to Ensure mapping to /app/logs in Docker
// In Docker, cwd is /app. So /app/logs/terminals.
const LOG_DIR = path.join(process.cwd(), 'logs/terminals');

// Ensure Log Directory
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Global Sessions Map: socketId -> { ptyProcess, logStream, requestInfo, connectionLogId }
const sessions = {};

// Helper: Get DB Credentials
function getDBCredentials(targetUsername) {
    if (!fs.existsSync(DB_USERS_FILE)) return null;

    // Default APPS user check
    if (targetUsername.toLowerCase() === 'apps') {
        return {
            username: process.env.ERP_DB_USER,
            password: process.env.ERP_DB_USER_PASSWORD
        };
    }

    try {
        const users = JSON.parse(fs.readFileSync(DB_USERS_FILE, 'utf8'));
        const user = users.find(u => u.username.toLowerCase() === targetUsername.toLowerCase());
        if (user) return { username: user.username, password: user.password };
    } catch (e) {
        console.error("Failed to read DB Users", e);
    }
    return null;
}

class TerminalService {
    async createSession(socketId, userInfo, requestInfo, options = {}) {
        const { access_db_user } = requestInfo;
        const { cols, rows } = options;

        const creds = getDBCredentials(access_db_user);
        if (!creds) {
            throw new Error(`Credential not found for DB User: ${access_db_user}`);
        }

        // Connection String
        const connectString = `//${process.env.ERP_DB_HOST}:${process.env.ERP_DB_PORT}/${process.env.ERP_DB_SERVICE_NAME}`;

        // Initialize SQL*Plus
        let shell = process.env.SQLPLUS_PATH || (process.platform === 'win32' ? 'sqlplus.exe' : 'sqlplus');

        if (process.env.SQLPLUS_PATH && !fs.existsSync(shell)) {
            console.warn(`[TerminalService] Warning: Configured SQLPLUS_PATH (${shell}) does not exist. Falling back to default.`);
            shell = process.platform === 'win32' ? 'sqlplus.exe' : 'sqlplus';
        }

        // Revert to /nolog as per user request to avoid ORA-12560 and CLI argument issues
        let spawnShell = shell;
        let spawnArgs = ['/nolog'];

        // Windows Fix: Force Code Page 65001 (UTF-8) to match NLS_LANG=.AL32UTF8
        // This prevents garbled text (Mojibake) in xterm.js
        if (process.platform === 'win32') {
            spawnShell = 'cmd.exe';
            spawnArgs = ['/c', `chcp 65001 > nul && ${shell} /nolog`];
        }

        const ptyProcess = pty.spawn(spawnShell, spawnArgs, {
            name: 'xterm-color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: process.env.HOME || process.cwd(),
            env: { ...process.env, NLS_LANG: 'TRADITIONAL CHINESE_TAIWAN.AL32UTF8' }
        });

        // Setup Logging
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${requestInfo.id}_${userInfo.username}_${timestamp}.log`;
        const logFile = path.join(LOG_DIR, filename);
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Log Header
        logStream.write(`--- Terminal Session Started: ${new Date().toISOString()} ---\n`);
        logStream.write(`User: ${userInfo.username} (#${userInfo.id})\n`);
        logStream.write(`Request: #${requestInfo.id}\n`);
        logStream.write(`Target DB User: ${access_db_user}\n`);
        logStream.write(`--------------------------------------------------\n`);

        // DB Logging
        let connectionLogId = null;
        try {
            const db = await dbWrapper.init();
            const res = db.prepare(`
                INSERT INTO connection_logs (application_id, user_id, username, log_filename, status)
                VALUES (?, ?, ?, ?, 'active')
            `).run(requestInfo.id, userInfo.id, userInfo.username, filename);
            connectionLogId = res.lastInsertRowid;
        } catch (e) {
            console.error('[TerminalService] Failed to insert connection log:', e);
        }

        // Store Session
        sessions[socketId] = {
            process: ptyProcess,
            logStream: logStream,
            requestInfo: requestInfo,
            connectionLogId: connectionLogId
        };

        // Auto-Login (Deferred to hide password from initial command line, masked in socket)
        setTimeout(() => {
            if (sessions[socketId]) {
                ptyProcess.write(`CONNECT ${creds.username}/${creds.password}@${connectString}\r`);
            }
        }, 500);

        return { ptyProcess, creds };
    }

    getSession(socketId) {
        return sessions[socketId];
    }

    write(socketId, data) {
        const session = sessions[socketId];
        if (session && session.process) {
            // console.log(`[TerminalService] Writing to pty: ${JSON.stringify(data)}`);
            session.process.write(data);
        }
    }

    resize(socketId, cols, rows) {
        const session = sessions[socketId];
        if (session && session.process) {
            session.process.resize(cols, rows);
        }
    }

    async kill(socketId) {
        const session = sessions[socketId];
        if (session) {
            // DB Update Closing
            if (session.connectionLogId) {
                try {
                    const db = await dbWrapper.init();
                    db.prepare(`
                        UPDATE connection_logs 
                        SET end_time = CURRENT_TIMESTAMP, status = 'closed' 
                        WHERE id = ?
                    `).run(session.connectionLogId);
                } catch (e) {
                    console.error('[TerminalService] Failed to update connection log:', e);
                }
            }

            if (session.process) {
                try {
                    session.process.write('EXIT\r');
                    setTimeout(() => {
                        try { session.process.kill(); } catch (e) { }
                    }, 1000);
                } catch (e) {
                    session.process.kill();
                }
            }
            if (session.logStream) {
                session.logStream.write(`\n--- Session Ended: ${new Date().toISOString()} ---\n`);
                session.logStream.end();
            }
            delete sessions[socketId];
        }
    }

    cleanup(socketId) {
        this.kill(socketId);
    }
}

module.exports = new TerminalService();
