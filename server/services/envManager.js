const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');

// Parse .env content into key-value pairs
function parseEnv(content) {
    const env = {};
    const lines = content.split('\n');
    for (const line of lines) {
        // Skip comments and empty lines
        if (!line || line.trim().startsWith('#')) continue;

        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        }
    }
    return env;
}

// Get all environment variables (filtered by allowed keys whitelist to avoid exposing system secrets)
const ALLOWED_KEYS = [
    // SMTP
    'SMTP_SERVER', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'FROM_ADDRESS', 'SENDER_ADDRESS',
    // LDAP
    'LDAP_URL', 'LDAP_BASE_DN', 'LDAP_MANAGER_DN', 'LDAP_MANAGER_PASSWORD',
    // ERP SSH
    'ERP_SSH_HOST', 'ERP_SSH_PORT', 'ERP_SSH_USERNAME', 'ERP_SSH_PASSWORD',
    // ERP FTP
    'ERP_FTP_HOST', 'ERP_FTP_PORT', 'ERP_FTP_USERNAME', 'ERP_FTP_PASSWORD',
    // ERP Compile
    'ERP_COMPILE_USER', 'ERP_COMPILE_PASSWORD',
    // Oracle DB
    'ERP_DB_HOST', 'ERP_DB_PORT', 'ERP_DB_SERVICE_NAME', 'ERP_DB_INSTANCE_NAME', 'ERP_DB_USER', 'ERP_DB_USER_PASSWORD'
];

exports.getEnvSettings = () => {
    if (!fs.existsSync(ENV_PATH)) return {};

    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const env = parseEnv(content);
    const result = {};

    ALLOWED_KEYS.forEach(key => {
        let value = env[key] || '';
        // Mask passwords
        if (key.includes('PASSWORD') || key.includes('KEY') || key.includes('SECRET')) {
            // Only mask if there is a value
            if (value) {
                value = '********';
            }
        }
        result[key] = value;
    });

    return result;
};

exports.updateEnvSettings = (newSettings) => {
    let content = '';
    if (fs.existsSync(ENV_PATH)) {
        content = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    const currentEnv = parseEnv(content);
    const lines = content.split('\n');
    const newLines = [];
    const keysUpdated = new Set();

    // Strategy: 
    // 1. Iterate through existing lines. If key is in newSettings, update line.
    // 2. If newSettings value is '********', KEEP ORIGINAL value (do not update).
    // 3. Append new keys that weren't in the file.

    for (let line of lines) {
        if (!line || line.trim().startsWith('#')) {
            newLines.push(line);
            continue;
        }

        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            if (ALLOWED_KEYS.includes(key) && newSettings.hasOwnProperty(key)) {
                const newValue = newSettings[key];

                // If it's a masked password, keep existing line
                if ((key.includes('PASSWORD') || key.includes('KEY') || key.includes('SECRET')) && newValue === '********') {
                    newLines.push(line);
                } else {
                    newLines.push(`${key}="${newValue}"`);
                }
                keysUpdated.add(key);
            } else {
                newLines.push(line);
            }
        } else {
            newLines.push(line);
        }
    }

    // Append new keys
    ALLOWED_KEYS.forEach(key => {
        if (newSettings.hasOwnProperty(key) && !keysUpdated.has(key)) {
            const newValue = newSettings[key];
            // Don't write masked value if it somehow got here for a new key (shouldn't happen usually)
            if (newValue !== '********') {
                newLines.push(`${key}="${newValue}"`);
            }
        }
    });

    fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf-8');
    return true;
};
