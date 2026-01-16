const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { db } = require('../database');
const dbModule = require('../database');

const CONFIG_PATH = path.join(__dirname, '../config/system.yaml');
// Default as per user request
const DEFAULT_BACKUP_PATH = 'E:/file_managerment_container/data';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../system.db');

class BackupService {
    constructor() {
        this.backupJob = null;
    }

    getBackupPath() {
        // 1. Environment Variable (Highest Priority for Dev/Docker overrides)
        if (process.env.BACKUP_FILES_DIR) {
            return process.env.BACKUP_FILES_DIR;
        }

        // 2. Try to read from config/system.yaml
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const content = fs.readFileSync(CONFIG_PATH, 'utf8');
                const match = content.match(/backup_path:\s*["']?([^"'\r\n]+)["']?/);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
        } catch (e) {
            console.error("Failed to read config/system.yaml", e);
        }
        return DEFAULT_BACKUP_PATH;
    }

    getDisplayPath() {
        // 1. Environment Variable (Highest Priority)
        if (process.env.BACKUP_FILES_DIR) {
            return process.env.BACKUP_FILES_DIR;
        }

        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const content = fs.readFileSync(CONFIG_PATH, 'utf8');
                const match = content.match(/backup_display_path:\s*["']?([^"'\r\n]+)["']?/);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
        } catch (e) { }
        return this.getBackupPath(); // Fallback to real path
    }

    async init() {
        console.log("Initializing Backup Service...");
        this.ensureBackupDir();
        this.reloadSchedule();
    }

    ensureBackupDir() {
        const dir = this.getBackupPath();
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (e) {
                console.error("Failed to create backup directory:", dir, e);
            }
        }
    }

    /**
     * Helper to parse cron or preset
     * @param {string} preset - 'daily', 'weekly', 'monthly', 'manual'
     * @param {string} time - 'HH:mm'
     */
    getCronFromPreset(preset, time = '02:00') {
        const [hour, minute] = time.split(':').map(Number);
        if (isNaN(hour) || isNaN(minute)) return '0 2 * * *'; // Default

        if (preset === 'daily') return `${minute} ${hour} * * *`;
        if (preset === 'weekly') return `${minute} ${hour} * * 0`; // Sunday
        if (preset === 'monthly') return `${minute} ${hour} 1 * *`; // 1st of month
        return null;
    }

    reloadSchedule() {
        if (this.backupJob) {
            this.backupJob.stop();
            this.backupJob = null;
        }

        try {
            // Check if table exists (it should)
            const row = db.prepare("SELECT value FROM system_settings WHERE key = 'BACKUP_SCHEDULE'").get();
            if (!row) {
                console.log("No backup schedule configured.");
                return;
            }

            const schedule = JSON.parse(row.value); // { frequency: 'daily', time: '02:00', enabled: true }

            if (!schedule.enabled || schedule.frequency === 'manual') {
                console.log("Backup schedule is disabled or manual.");
                return;
            }

            const cronExp = this.getCronFromPreset(schedule.frequency, schedule.time);

            if (cronExp) {
                console.log(`Scheduling Database Backup with cron: ${cronExp}`);
                this.backupJob = cron.schedule(cronExp, () => {
                    console.log("Executing Scheduled Database Backup...");
                    this.performBackup('Scheduled');
                });
            }
        } catch (e) {
            console.error("Error reloading backup schedule:", e);
        }
    }

    performBackup(trigger = 'Manual') {
        try {
            const dir = this.getBackupPath();
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            // Timestamp format: YYYY-MM-DDTHH-mm-ss
            // To match mockup: backup_2026-01-12T18-00-00-154Z.db (ISO style but safe)
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `backup_${timestamp}.db`;
            const destPath = path.join(dir, filename);

            fs.copyFileSync(DB_PATH, destPath);

            console.log(`Backup created: ${destPath} (${trigger})`);
            return { success: true, filename, path: destPath };
        } catch (e) {
            console.error("Backup failed", e);
            throw e;
        }
    }

    listBackups() {
        try {
            const dir = this.getBackupPath();
            if (!fs.existsSync(dir)) return [];

            const files = fs.readdirSync(dir)
                .filter(f => f.endsWith('.db'))
                .map(f => {
                    try {
                        const stat = fs.statSync(path.join(dir, f));
                        return {
                            name: f,
                            size: (stat.size / (1024 * 1024)).toFixed(2) + ' MB', // Convert to MB string
                            created_at: stat.mtime
                        };
                    } catch (e) { return null; }
                })
                .filter(Boolean)
                .sort((a, b) => b.created_at - a.created_at); // Newest first
            return files;
        } catch (e) {
            console.error("List backups failed", e);
            return [];
        }
    }

    deleteBackup(filename) {
        try {
            const dir = this.getBackupPath();
            const filePath = path.join(dir, filename);
            // Security check
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                throw new Error("Invalid filename");
            }
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Delete backup failed", e);
            throw e;
        }
    }

    async restoreBackup(filename) {
        const dir = this.getBackupPath();
        const srcPath = path.join(dir, filename);

        if (!fs.existsSync(srcPath)) {
            throw new Error("Backup file not found");
        }

        // 1. Create a safety backup of current state locally before overwriting
        const safetyBackup = DB_PATH + '.pre_restore_bak';
        try {
            fs.copyFileSync(DB_PATH, safetyBackup);
        } catch (e) { console.warn("Could not create pre-restore backup", e); }

        // 2. Overwrite DB
        fs.copyFileSync(srcPath, DB_PATH);

        // 3. Reload
        await dbModule.reload();

        return true;
    }
}

module.exports = new BackupService();
