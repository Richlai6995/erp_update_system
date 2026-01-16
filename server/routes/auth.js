const express = require('express');
const router = express.Router();

const { v4: uuidv4 } = require('uuid');

// Simple in-memory session store (Map: token -> userObject)
const sessions = new Map();

const ldap = require('ldapjs');
require('dotenv').config();

// LDAP Config
const LDAP_CONFIG = {
    url: process.env.LDAP_URL || 'ldap://10.8.91.152:389', // Fallback to IP if env missing
    baseDN: process.env.LDAP_BASE_DN,
    managerDN: process.env.LDAP_MANAGER_DN,
    managerPass: process.env.LDAP_MANAGER_PASSWORD,
    reconnect: true,
    strictDN: false,
    tlsOptions: { rejectUnauthorized: false }
};

// LDAP Helper
const authenticateLDAP = (account, password) => {
    return new Promise((resolve, reject) => {
        try {
            const client = ldap.createClient(LDAP_CONFIG);

            client.on('error', (err) => {
                console.error('LDAP Client Error:', err.message);
                // Usually we can't recover here, but let the bind fail
            });

            // 1. Bind Manager
            console.log(`[LDAP] Binding Manager: ${LDAP_CONFIG.managerDN}`);
            client.bind(LDAP_CONFIG.managerDN, LDAP_CONFIG.managerPass, (err) => {
                if (err) {
                    console.error("[LDAP] Manager Bind Failed:", err);
                    client.unbind();
                    return reject({ type: 'sys', error: err });
                }

                // 2. Search User
                const opts = {
                    filter: `(sAMAccountName=${account})`,
                    scope: 'sub',
                    attributes: ['dn', 'sAMAccountName', 'displayName', 'mail', 'cn']
                };
                console.log(`[LDAP] Searching User: ${account}`);

                client.search(LDAP_CONFIG.baseDN, opts, (err, res) => {
                    if (err) {
                        console.error("[LDAP] Search Error:", err);
                        client.unbind();
                        return reject({ type: 'sys', error: err });
                    }

                    let userEntry = null;

                    res.on('searchEntry', (entry) => {
                        let attributes = {};
                        if (entry.attributes && Array.isArray(entry.attributes)) {
                            entry.attributes.forEach(a => {
                                attributes[a.type] = a.vals || a.values; // Compatibility
                            });
                        } else if (entry.object) {
                            attributes = entry.object;
                        }
                        userEntry = { dn: entry.objectName || entry.dn, ...attributes };
                    });

                    res.on('end', (result) => {
                        console.log(`[LDAP] User Found: ${userEntry ? userEntry.dn : "None"}`);

                        if (!userEntry) {
                            client.unbind();
                            return resolve(null); // User not found in LDAP
                        }

                        // 3. Bind User (Verify Password)
                        const userClient = ldap.createClient(LDAP_CONFIG); // Use same config
                        const userDn = userEntry.dn.toString();

                        console.log(`[LDAP] Binding User: ${userDn}`);
                        userClient.bind(userDn, password, (err) => {
                            userClient.unbind();
                            client.unbind();

                            if (err) {
                                console.error(`[LDAP] User Auth Failed:`, err);
                                return reject({ type: 'auth', error: 'Invalid Credentials' });
                            }
                            console.log(`[LDAP] User Auth Success`);

                            // Parse Data
                            // displayName format: "12345 Name" or just "Name"
                            let employeeId = '';
                            let name = '';

                            const rawDisplayName = userEntry.displayName;
                            const displayName = Array.isArray(rawDisplayName) ? rawDisplayName[0] : (rawDisplayName || '');

                            if (displayName) {
                                const parts = displayName.trim().split(' ');
                                if (parts.length > 0 && /^\d+$/.test(parts[0])) {
                                    employeeId = parts[0];
                                    if (parts.length > 1) name = parts.slice(1).join(' ');
                                } else {
                                    name = displayName;
                                }
                            }
                            if (!name) name = account;

                            const rawMail = userEntry.mail;
                            const email = Array.isArray(rawMail) ? rawMail[0] : (rawMail || null);

                            resolve({
                                account: account.toUpperCase(),
                                name: name, // This maps to DB 'name'
                                employeeId: employeeId,
                                email: email
                            });
                        });
                    });

                    res.on('error', (err) => {
                        client.unbind();
                        reject({ type: 'sys', error: err });
                    });
                });
            });
        } catch (e) {
            reject({ type: 'sys', error: e });
        }
    });
};


// LOGIN Route
router.post('/login', async (req, res) => {
    let { username, password } = req.body;
    username = username ? username.trim() : '';

    if (!username || !password) {
        return res.status(400).json({ error: 'Account and password required' });
    }

    try {
        const db = require('../database').db;

        // 1. Try LDAP First (Skip for ADMIN)
        let isLdapTry = true;
        if (username.toUpperCase() === 'ADMIN') {
            isLdapTry = false;
        }

        if (isLdapTry) {
            try {
                const ldapUser = await authenticateLDAP(username, password);

                if (ldapUser) {
                    // Check if exists in DB
                    let dbUser = db.prepare('SELECT * FROM users WHERE username = ?').get(ldapUser.account);

                    if (dbUser) {
                        // Update User Info (Sync latest from LDAP + Password)
                        try {
                            db.prepare(`
                                UPDATE users 
                                SET name = ?, email = ?, employee_id = ?, password = ? 
                                WHERE id = ?
                            `).run(ldapUser.name, ldapUser.email, ldapUser.employeeId, password, dbUser.id);
                        } catch (e) {
                            console.error("Update User Error:", e);
                        }

                        if (dbUser.status !== 'active') { // DB uses 'status' ('active'/'inactive')
                            return res.status(403).json({ error: '帳號失效,請聯絡系統管理員' });
                        }

                        // Refetch updated user
                        dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(dbUser.id);
                        return createSession(res, dbUser);
                    } else {
                        // Create New Inactive User
                        // Default department? maybe null or 'General'
                        db.prepare(`
                            INSERT INTO users (username, name, email, role, status, password, employee_id, department) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `).run(ldapUser.account, ldapUser.name, ldapUser.email, 'user', 'inactive', password, ldapUser.employeeId, 'General');

                        return res.status(403).json({ error: '第一次登入成功,請聯絡管理員啟動帳號' });
                    }
                }
            } catch (ldapErr) {
                console.log("LDAP Auth failed/error, falling back to local DB...", ldapErr.type || ldapErr);
                // System errors or Auth errors both allow fallback (in case LDAP is down but local admin needs access)
            }
        }

        // 2. Fallback: Local DB Auth
        // Case-sensitive check usually depends on DB collation, but simple query here
        const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);

        if (!user) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        if (user.role !== 'admin' && user.status !== 'active') { // Check status
            return res.status(403).json({ error: '帳號失效,請聯絡系統管理員' });
        }

        // Check validity period
        const now = new Date();
        if (user.start_date && new Date(user.start_date) > now) {
            return res.status(403).json({ error: '帳號尚未生效' });
        }
        if (user.end_date && new Date(user.end_date) < now) {
            return res.status(403).json({ error: '帳號已過期' });
        }

        return createSession(res, user);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Helper to Create Session
const createSession = (res, user) => {
    const token = uuidv4();
    sessions.set(token, {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: JSON.parse(user.permissions || '{}'),
        name: user.name,
        department: user.department,
        createdAt: Date.now() // Store creation time
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
};

// ... LOGOUT ...

// Middleware to verify token
const verifyToken = (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ error: 'No token provided' });

    const session = sessions.get(token);

    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check Exipry (24 Hours)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt > ONE_DAY) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Token expired' });
    }

    req.user = session;
    next();
};

module.exports = { router, verifyToken, sessions };
