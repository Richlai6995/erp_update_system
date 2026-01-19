const pty = require('node-pty');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_USERS_FILE = path.join(__dirname, '../config/db_users.json');
const LOG_DIR = path.join(__dirname, '../../logs/terminals');

// Ensure Log Directory
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Global Sessions Map: socketId -> { ptyProcess, logStream, requestInfo }
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
    createSession(socketId, userInfo, requestInfo, options = {}) {
        const { access_db_user } = requestInfo;
        const { cols, rows } = options;

        const creds = getDBCredentials(access_db_user);
        if (!creds) {
            throw new Error(`Credential not found for DB User: ${access_db_user}`);
        }

        // Connection String
        const connectString = `//${process.env.ERP_DB_HOST}:${process.env.ERP_DB_PORT}/${process.env.ERP_DB_SERVICE_NAME}`;

        // Initialize SQL*Plus
        // Use 'sqlplus /nolog' to avoid showing password in process list
        // On Windows, use 'sqlplus.exe'
        let shell = process.env.SQLPLUS_PATH || (process.platform === 'win32' ? 'sqlplus.exe' : 'sqlplus');

        // Sanity Check: If explicit path provided, check existence
        if (process.env.SQLPLUS_PATH && !fs.existsSync(shell)) {
            console.warn(`[TerminalService] Warning: Configured SQLPLUS_PATH (${shell}) does not exist. Falling back to default.`);
            shell = process.platform === 'win32' ? 'sqlplus.exe' : 'sqlplus';
        }

        console.log(`[TerminalService] Spawning Shell: '${shell}'`);

        const ptyProcess = pty.spawn(shell, ['/nolog'], {
            name: 'xterm-color',
            cols: cols || 80,
            rows: rows || 24,
            cwd: process.env.HOME || process.cwd(),
            env: { ...process.env, NLS_LANG: 'TRADITIONAL CHINESE_TAIWAN.AL32UTF8' } // Force UTF8/Traditional Chinese
        });

        // Setup Logging
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(LOG_DIR, `${requestInfo.id}_${userInfo.username}_${timestamp}.log`);
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Log Header
        logStream.write(`--- Terminal Session Started: ${new Date().toISOString()} ---\n`);
        logStream.write(`User: ${userInfo.username} (#${userInfo.id})\n`);
        logStream.write(`Request: #${requestInfo.id}\n`);
        logStream.write(`Target DB User: ${access_db_user}\n`);
        logStream.write(`--------------------------------------------------\n`);

        // Store Session
        sessions[socketId] = {
            process: ptyProcess,
            logStream: logStream,
            requestInfo: requestInfo
        };

        // Auto-Login
        // Wait a small bit for prompt or just send it immediately
        setTimeout(() => {
            if (sessions[socketId]) { // Ensure session still exists
                ptyProcess.write(`CONNECT ${creds.username}/${creds.password}@${connectString}\r`);
                // ptyProcess.write(`CLEAR SCREEN\r`); // Optional
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
            session.process.write(data);
            // We log input too if needed, but logging output is usually sufficient for audit
            // session.logStream.write(`[INPUT] ${data}`); 
        }
    }

    resize(socketId, cols, rows) {
        const session = sessions[socketId];
        if (session && session.process) {
            session.process.resize(cols, rows);
        }
    }

    kill(socketId) {
        const session = sessions[socketId];
        if (session) {
            if (session.process) {
                // Exit cleanly if possible
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

    // Cleanup Check (e.g., if socket disconnects without kill)
    cleanup(socketId) {
        this.kill(socketId);
    }
}

module.exports = new TerminalService();
