const terminalService = require('../services/terminalService');
// const jwt = require('jsonwebtoken'); // Not using JWT
const { sessions } = require('../routes/auth'); // Import shared sessions
const dbExports = require('../database');
require('dotenv').config();

module.exports = function (io) {
    console.log('[Socket.IO] Initializing /terminal namespace...');
    // console.log('[Socket.IO] JWT Secret loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');
    const terminalNamespace = io.of('/terminal');

    terminalNamespace.use((socket, next) => {
        // Authentication Middleware
        const token = socket.handshake.auth.token;
        if (!token) {
            console.error('[Terminal] Auth Failed: No token provided');
            return next(new Error('Authentication error: No token'));
        }

        // Verify Session (UUID)
        const session = sessions.get(token);

        if (!session) {
            console.error('[Terminal] Auth Failed: Invalid Session Token');
            return next(new Error('Authentication error: Invalid Token'));
        }

        // Check Expiry (Optional, matched auth.js logic)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - session.createdAt > ONE_DAY) {
            console.error('[Terminal] Auth Failed: Token Expired');
            return next(new Error('Authentication error: Token Expired'));
        }

        socket.user = session; // Attach user/session to socket
        next();
    });

    terminalNamespace.on('connection', (socket) => {
        console.log(`[Terminal] User ${socket.user.username} connected (Socket: ${socket.id})`);

        socket.on('start-session', async ({ requestId, cols, rows }) => {
            try {
                // 1. Validate Request
                const { db } = dbExports;
                const requestDetail = db.prepare('SELECT * FROM applications WHERE id = ?').get(requestId);

                if (!requestDetail) {
                    socket.emit('terminal-error', 'Request not found');
                    return;
                }

                // 2. Validate Permissions (Status & Time)
                const now = new Date();
                const startTime = requestDetail.access_start_time ? new Date(requestDetail.access_start_time) : null;
                const endTime = requestDetail.access_end_time ? new Date(requestDetail.access_end_time) : null;

                if (requestDetail.status !== 'approved' && requestDetail.applicant_id !== socket.user.id) {
                    // Maybe allow applicant to test if approved? 
                    // Usually only 'approved' status allows session.
                    // Or maybe 'dba_processing'?
                    if (requestDetail.status !== 'approved') {
                        socket.emit('terminal-error', 'Request is not currently approved for access.');
                        return;
                    }
                }

                if (startTime && now < startTime) {
                    socket.emit('terminal-error', `Access not started yet. Starts at: ${startTime.toLocaleString()}`);
                    return;
                }
                if (endTime && now > endTime) {
                    socket.emit('terminal-error', `Access expired. Ended at: ${endTime.toLocaleString()}`);
                    return;
                }

                if (!requestDetail.access_db_user) {
                    socket.emit('terminal-error', 'No Target DB User specified for this request.');
                    return;
                }

                // 2.5 Setup Auto-Disconnect Timer
                if (endTime) {
                    const timeUntilExpiry = endTime.getTime() - now.getTime();
                    if (timeUntilExpiry > 0) {
                        // Max setTimeout is ~24 days. Assuming session length is reasonable.
                        const timeoutId = setTimeout(() => {
                            if (socket.connected) {
                                socket.emit('output', '\r\n\x1b[31m[System] Access time expired. Disconnecting session...\x1b[0m\r\n');
                                socket.disconnect(true);
                            }
                        }, timeUntilExpiry);

                        // Clear timeout if socket disconnects manually
                        socket.on('disconnect', () => clearTimeout(timeoutId));
                    }
                }

                // 3. Start Terminal
                try {
                    const { ptyProcess, creds } = await terminalService.createSession(socket.id, socket.user, requestDetail, { cols, rows });

                    ptyProcess.onData((data) => {
                        // Security: Mask Password in Output and Log
                        let output = data;

                        // Mask the specific CONNECT command (Case insensitive, handle potential split chunks aggressively)
                        if (output.match(/CONNECT\s+.*\/.+@/i)) {
                            output = output.replace(/CONNECT\s+.*\/.+@/ig, 'CONNECT ******@');
                        } else if (output.includes(creds.password)) {
                            // Fallback for simple matches
                            output = output.split(creds.password).join('******');
                        }

                        socket.emit('output', output);

                        // Also write to log (MASKED content)
                        const session = terminalService.getSession(socket.id);
                        if (session && session.logStream) {
                            // Clean up log output: Remove Clear Screen/Home codes causing blank space
                            let logOutput = output
                                .replace(/\x1b\[2J/g, '') // Remove Clear Screen
                                .replace(/\x1b\[H/g, '')  // Remove Cursor Home
                                .replace(/\x1b\[\?25[lh]/g, ''); // Remove Hide/Show Cursor

                            // Collapse excessive newlines (3 or more -> 2)
                            logOutput = logOutput.replace(/(\r\n|\n){3,}/g, '\r\n\r\n');

                            session.logStream.write(logOutput);
                        }
                    });

                    ptyProcess.onExit(() => {
                        socket.emit('session-ended');
                        terminalService.cleanup(socket.id);
                    });

                    // 4. Set Auto-Disconnect Timer
                    if (endTime) {
                        const timeUntilExpiry = endTime.getTime() - new Date().getTime();
                        if (timeUntilExpiry > 0) {
                            // Max delay for setTimeout is ~24 days, usually fine for sessions
                            socket.disconnectTimer = setTimeout(() => {
                                console.log(`[Terminal] Session expired for ${socket.user.username}. Disconnecting...`);
                                socket.emit('terminal-error', 'Session time expired. Auto-disconnecting...');
                                terminalService.kill(socket.id);
                                socket.disconnect(true);
                            }, timeUntilExpiry);
                        }
                    }

                } catch (err) {
                    console.error("Failed to start terminal:", err);
                    socket.emit('terminal-error', 'Failed to start terminal session: ' + err.message);
                }

            } catch (e) {
                console.error("Terminal Session Error:", e);
                socket.emit('terminal-error', 'Server error');
            }
        });

        socket.on('input', (data) => {
            // console.log(`[Terminal] Input from ${socket.user.username}: ${JSON.stringify(data)}`);
            terminalService.write(socket.id, data);
        });

        socket.on('resize', ({ cols, rows }) => {
            terminalService.resize(socket.id, cols, rows);
        });

        socket.on('disconnect', () => {
            console.log(`[Terminal] User ${socket.user.username} disconnected`);
            if (socket.disconnectTimer) {
                clearTimeout(socket.disconnectTimer);
            }
            terminalService.kill(socket.id);
        });
    });
};
