const cron = require('node-cron');
const { db } = require('../database');
const DocGenerator = require('./docGenerator');
const mailService = require('./mailService');
const fs = require('fs');
const path = require('path');

class Scheduler {
    constructor() {
        this.jobs = new Map(); // Store cron jobs by schedule ID
    }

    async init() {
        console.log('Initializing Scheduler...');
        const schedules = this.getAllEnabledSchedules();
        for (const schedule of schedules) {
            this.scheduleJob(schedule);
        }
        await this.scheduleGlobalSync();
        console.log(`Scheduler initialized with ${this.jobs.size} jobs.`);
    }

    getAllEnabledSchedules() {
        // Join with templates to ensure template still exists?
        // For now simple select
        const stmt = db.prepare("SELECT * FROM doc_schedules WHERE enabled = 1");
        // db.prepare returns a StatementWrapper which has .all()
        const schedules = stmt.all();
        return schedules;
    }

    scheduleJob(schedule) {
        if (this.jobs.has(schedule.id)) {
            this.jobs.get(schedule.id).stop();
            this.jobs.delete(schedule.id);
        }

        if (!schedule.enabled) return;

        try {
            const job = cron.schedule(schedule.cron_expression, async () => {
                console.log(`Executing Schedule ID: ${schedule.id} for Template ID: ${schedule.template_id}`);
                try {
                    // Calculate Target Date
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + (schedule.date_offset || 0));

                    // Generate Document
                    // Generate Document
                    const result = await DocGenerator.generateDocument(schedule.template_id, targetDate);

                    // Determine Output Path
                    // We need project info to know where to save
                    const template = DocGenerator.getTemplate(schedule.template_id);
                    const project = DocGenerator.getProject(template.project_id);

                    if (!project || !project.local_path) {
                        console.error(`Project or Local Path not found for Schedule ${schedule.id}`);
                        return;
                    }

                    // Format Date Folder Name
                    const year = targetDate.getFullYear();
                    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                    const day = String(targetDate.getDate()).padStart(2, '0');
                    const dateFolder = `${year}-${month}-${day}`;



                    let outputDir = project.local_path;

                    // DOCKER SUPPORT: Override local_path if running in container
                    if (process.env.FILES_ROOT_DIR) {
                        // Strategy: Try to find relative path from 'file_management_container' or 'files'
                        // DB Path: D:\vibe_coding\file_management_container\A1 C223專案\RICH_PJ1
                        // Host Path: E:\file_managerment_container\files\A1 C223專案\RICH_PJ1

                        const normalizedPath = project.local_path.replace(/\\/g, '/');

                        // Try to split by container folder name first
                        // Matches /erp_update_system_container/ or /file_manage(r)ment_container/
                        const containerRegex = /\/(erp_update_system_container|file_manager?me?nt_container)\//i;
                        const containerMatch = normalizedPath.match(containerRegex);

                        let callbackPath = null;

                        if (containerMatch) {
                            // Use everything after the container folder
                            const idx = containerMatch.index + containerMatch[0].length;
                            callbackPath = normalizedPath.substring(idx);
                        } else {
                            // Try 'files'
                            const fileMarker = '/files/';
                            const idx = normalizedPath.lastIndexOf(fileMarker);
                            if (idx !== -1) {
                                callbackPath = normalizedPath.substring(idx + fileMarker.length);
                            }
                        }

                        if (callbackPath) {
                            outputDir = path.join(process.env.FILES_ROOT_DIR, callbackPath);
                            console.log(`[Scheduler] Docker Environment Detected. Remapped path to: ${outputDir}`);
                        } else {
                            console.warn(`[Scheduler] Warning: Could not resolve relative path. DB Path: ${project.local_path}. Fallback: FILES_ROOT_DIR/ProjectName.`);
                            outputDir = path.join(process.env.FILES_ROOT_DIR, project.name);
                        }
                    }

                    // Re-calculate date folder path based on resolved outputDir
                    const dateFolderPath = path.join(outputDir, dateFolder);

                    if (fs.existsSync(dateFolderPath)) {
                        outputDir = dateFolderPath;
                    } else {
                        // USER REQUEST: If date folder does not exist, SKIP execution.
                        console.log(`[Scheduler] Date folder not found: ${dateFolderPath}. Skipping schedule ${schedule.id}.`);
                        return;
                    }



                    // Filename: TemplateName_YYYY-MM-DD_HHmmss.html
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const safeTemplateName = template.name.replace(/[^a-z0-9]/gi, '_');
                    const filename = `${safeTemplateName}_${dateFolder}_${timestamp}.html`;
                    const outputPath = path.join(outputDir, filename);

                    // result.htmlContent is the string content
                    fs.writeFileSync(outputPath, result.htmlContent);
                    console.log(`Generated Document: ${outputPath}`);

                    // Send Email
                    if (template.email_to) {
                        console.log(`[Scheduler] Sending email for Schedule ${schedule.id}...`);
                        await mailService.sendEmail({
                            from: template.email_from,
                            to: template.email_to,
                            cc: template.email_cc,
                            subject: template.email_subject || `Generated Document: ${safeTemplateName}`,
                            html: result.htmlContent, // Use the generated HTML
                            executor: 'Scheduler',
                            fileName: filename,
                            projectName: project.name,
                            pathInfo: dateFolder,
                            scheduleId: schedule.id
                        });
                    }

                } catch (error) {
                    console.error(`Error executing schedule ${schedule.id}:`, error);
                }
            });

            this.jobs.set(schedule.id, job);
        } catch (err) {
            console.error(`Failed to schedule job ${schedule.id}:`, err);
        }
    }

    removeJob(scheduleId) {
        if (this.jobs.has(scheduleId)) {
            this.jobs.get(scheduleId).stop();
            this.jobs.delete(scheduleId);
        }
    }

    reloadSchedule(scheduleId) {
        const stmt = db.prepare("SELECT * FROM doc_schedules WHERE id = ?");
        const schedule = stmt.get(scheduleId);
        if (schedule) {
            this.scheduleJob(schedule);
        } else {
            this.removeJob(scheduleId);
        }
    }

    async scheduleGlobalSync() {
        // Default to run daily at 3 AM if not configured
        // In a real app, fetch this from system_settings table
        const cronExp = '0 3 * * *';

        // Check DB for override
        try {
            // const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'GLOBAL_SYNC_CRON'").get();
            // if (setting) cronExp = setting.value;
        } catch (e) { }

        console.log(`[Scheduler] Scheduling Global Sync with cron: ${cronExp}`);
        const job = cron.schedule(cronExp, async () => {
            console.warn('[Scheduler] Global Sync is DISABLED due to logic mismatch (Flat vs Folder structure). Skipping execution to prevent data loss.');
            /* 
            // CRITICAL: DISABLED TO PREVENT DATA LOSS
            // The ProjectSyncService expects a folder structure that does not exist in the current flat upload architecture.
            // Enabling this would cause the sync service to think all files are missing and delete them from DB.
            console.log('[Scheduler] Executing Scheduled Global Sync...');
            try {
                const ProjectSyncService = require('./projectSyncService');
                await ProjectSyncService.syncAllProjects();
            } catch (e) {
                console.error('[Scheduler] Global Sync Failed:', e);
            }
            */
        });
        this.jobs.set('GLOBAL_SYNC', job);
    }
}

// Export singleton
const scheduler = new Scheduler();
module.exports = scheduler;
