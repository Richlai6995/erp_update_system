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
    'ERP_DB_HOST', 'ERP_DB_PORT', 'ERP_DB_SERVICE_NAME', 'ERP_DB_INSTANCE_NAME', 'ERP_DB_USER', 'ERP_DB_USER_PASSWORD',
    // Other
    'SQLPLUS_PATH'
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
    console.log('[EnvManager] Updating settings:', Object.keys(newSettings));
    console.log('[EnvManager] Target ENV_PATH:', ENV_PATH);

    let content = '';
    if (fs.existsSync(ENV_PATH)) {
        content = fs.readFileSync(ENV_PATH, 'utf-8');
    } else {
        console.warn('[EnvManager] .env file not found, creating new one.');
    }

    // Split by new line, handling different line endings
    let lines = content.split(/\r?\n/);
    const newLines = [];
    const keysUpdated = new Set();

    for (let line of lines) {
        // Keep empty lines or pure comments
        if (!line.trim() || line.trim().startsWith('#')) {
            newLines.push(line);
            continue;
        }

        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            // If this key is in our update list, we replace the line
            if (ALLOWED_KEYS.includes(key) && newSettings.hasOwnProperty(key)) {

                // If we already updated this key (duplicate in file), skip subsequent occurrences to clean up file
                if (keysUpdated.has(key)) continue;

                const newValue = newSettings[key];

                // If it's a masked password, keep existing line (do not update)
                // UNLESS the user cleared it (empty string)? No, '********' means unchanged.
                if ((key.includes('PASSWORD') || key.includes('KEY') || key.includes('SECRET')) && newValue === '********') {
                    console.log(`[EnvManager] Skipping masked password for ${key}`);
                    newLines.push(line);
                } else {
                    console.log(`[EnvManager] Updating ${key}`);
                    newLines.push(`${key}=${newValue}`);
                    // Update process.env immediately for runtime changes
                    process.env[key] = newValue;
                }
                keysUpdated.add(key);
            } else {
                // Not in allowed keys or not in update payload, keep original
                newLines.push(line);
            }
        } else {
            // Malformed line? Keep it.
            newLines.push(line);
        }
    }

    // Append new keys that weren't found in the existing file
    ALLOWED_KEYS.forEach(key => {
        if (newSettings.hasOwnProperty(key) && !keysUpdated.has(key)) {
            const newValue = newSettings[key];
            if (newValue && newValue !== '********') {
                console.log(`[EnvManager] Appending new key ${key}`);
                newLines.push(`${key}=${newValue}`);
                // Update process.env immediately for runtime changes
                process.env[key] = newValue;
            }
        }
    });

    // Write back with consistent LF (or CRLF if on Windows node, but fs.writeFileSync handles bytes)
    // We join with \n. On Windows, editors handle it fine usually, or use os.EOL
    const EOL = require('os').EOL;
    try {
        fs.writeFileSync(ENV_PATH, newLines.join(EOL), 'utf-8');
        console.log('[EnvManager] Successfully wrote .env file');
        return true;
    } catch (err) {
        console.error('[EnvManager] Error writing .env file:', err);
        throw err;
    }
};
