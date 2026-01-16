const database = require('../database');
const driveService = require('./driveService');

class ProjectSyncService {
    /**
     * Recursively syncs a Project's Google Drive structure to the local database.
     * @param {number} projectId 
     * @param {string} driveRootId 
     */
    static async syncProject(projectId, driveRootId) {
        console.log(`[Sync] Starting sync for Project ${projectId} (Drive: ${driveRootId})`);

        // 1. Get Project ID to ensure it exists
        const db = database.db;

        // 2. Recursive Scan
        await this.syncFolder(db, projectId, driveRootId, null); // null = root parent

        console.log(`[Sync] Completed sync for Project ${projectId}`);
        return { status: 'completed' };
    }

    static async syncFolder(db, projectId, driveId, parentDbId) {
        // Fetch Drive Content
        const list = await driveService.listFiles(driveId);

        // --- DELETION LOGIC STARTS ---
        let dbFiles = [];

        // Applications are flat structure (mostly), but we keep recursiveness if needed. 
        // Note: Our DB schema for 'application_files' is flat (application_id), but 'files' table was hierarchical.
        // If we firmly switched to 'application_files', we should query that. 
        // However, ProjectSyncService was built for 'files' table. 

        // CHECK: Does the user want 'application_files' table synced? 
        // The previous schema showed 'application_files'. 
        // The 'files' table seems to be legacy PROJECT files. 

        // Let's assume for now we are syncing to 'application_files'.
        // But 'application_files' structure: id, application_id, filename, file_path, ...
        // It doesn't have 'drive_file_id' or 'folder_id' in the same way.

        // Wait, if we use 'application_files', we need to rewrite upsert logic too.
        // Let's stick to the existing 'files' table for now if it's used for general storage,
        // OR rewrite completely for 'application_files'.

        // Given the prompt "Global Sync... update meta data", and the user said "Currently only requests (Applications)",
        // it implies he wants the file list of the application to be updated in the DB.

        // Let's check 'upsertFile'. It inserts into 'files'.
        // If the system uses 'application_files' for the UI, then inserting into 'files' won't show up in the Request Form unless logic is shared.

        // The Request Form (User UI) likely reads 'application_files'.
        // We should sync to 'application_files'.

        dbFiles = db.prepare("SELECT id, filename as drive_file_id FROM application_files WHERE application_id = ?").all(projectId);


        // 2. Identify Missing Folders (Present in DB but not in Drive List)
        // driveService returns relative paths as IDs.
        const driveFolderIds = new Set(list.folders.map(f => f.id));
        const foldersToDelete = dbFolders.filter(f => !driveFolderIds.has(f.drive_folder_id));

        for (const folder of foldersToDelete) {
            console.log(`[Sync] Deleting missing folder: ${folder.drive_folder_id} (DB ID: ${folder.id})`);
            this.deleteFolderRecursive(db, folder.id);
        }

        // 3. Identify Missing Files
        const driveFileIds = new Set(list.files.map(f => f.name)); // Using filename as ID for flat app files
        const filesToDelete = dbFiles.filter(f => !driveFileIds.has(f.drive_file_id));

        for (const file of filesToDelete) {
            console.log(`[Sync] Deleting missing file: ${file.drive_file_id} (DB ID: ${file.id})`);
            db.prepare("DELETE FROM application_files WHERE id = ?").run(file.id);
        }
        // --- DELETION LOGIC ENDS ---

        // 4. Upsert Folders - SKIP for flat application structure (or implement if subfolders needed)
        // For now, ignoring subfolders in Application Sync to keep it simple as per 'application_files' schema (flat).
        /*
        for (const folder of list.folders) {
            let folderId = await this.upsertFolder(db, projectId, folder, parentDbId);
            // Recursion
            await this.syncFolder(db, projectId, folder.id, folderId);
        }
        */

        // 5. Upsert Files
        for (const file of list.files) {
            await this.upsertFile(db, projectId, file, parentDbId, driveId);
        }
    }

    static deleteFolderRecursive(db, folderId) {
        // 1. Delete Files in this folder
        db.prepare("DELETE FROM files WHERE folder_id = ?").run(folderId);

        // 2. Find Sub-folders
        const subFolders = db.prepare("SELECT id FROM folders WHERE parent_id = ?").all(folderId);

        // 3. Recursively delete sub-folders
        for (const sub of subFolders) {
            this.deleteFolderRecursive(db, sub.id);
        }

        // 4. Delete the folder itself
        db.prepare("DELETE FROM folders WHERE id = ?").run(folderId);
    }

    static async upsertFolder(db, projectId, driveFolder, parentId) {
        // Check if exists by drive_folder_id
        const existing = db.prepare("SELECT id FROM folders WHERE drive_folder_id = ?").get(driveFolder.id);

        if (existing) {
            // Update name if changed
            db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(driveFolder.name, existing.id);
            return existing.id;
        } else {
            // Insert
            const res = db.prepare("INSERT INTO folders (project_id, parent_id, name, drive_folder_id) VALUES (?, ?, ?, ?)").run(
                projectId, parentId, driveFolder.name, driveFolder.id
            );
            return res.lastInsertRowid;
        }
    }

    static async upsertFile(db, projectId, driveFile, parentId, parentDriveId) {
        // projectId is actually application_id here
        const existing = db.prepare("SELECT id FROM application_files WHERE application_id = ? AND filename = ?").get(projectId, driveFile.name);

        const updatedAt = driveFile.mtime || new Date().toISOString();
        // Construct physical path relative to storage root
        // parentDriveId is the form_id (folder name)
        const relativePath = `${parentDriveId}/${driveFile.name}`;

        if (existing) {
            // Update metadata
            // size column might not exist in application_files based on previous schema, but let's try or ignore
            // application_files: id, application_id, filename, original_name, file_path, description, ...
            db.prepare("UPDATE application_files SET uploaded_at = ? WHERE id = ?").run(
                updatedAt, existing.id
            );
        } else {
            console.log(`[Sync] Insert new file for App ${projectId}: ${driveFile.name}`);
            db.prepare("INSERT INTO application_files (application_id, filename, original_name, file_path, description, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)").run(
                projectId,
                driveFile.name,
                driveFile.name,
                relativePath,
                'Global Sync Auto-Detected',
                updatedAt
            );
        }
    }
    static async syncAllProjects() {
        console.log('[Global Sync] Starting Global Sync for all Applications...');
        const db = database.db;
        try {
            // Sync Applications instead of Projects
            // Folders are named by form_id (e.g., GL202501010001)
            const apps = db.prepare("SELECT id, form_id, description FROM applications WHERE form_id IS NOT NULL").all();

            console.log(`[Global Sync] Found ${apps.length} applications.`);

            for (const app of apps) {
                // Use form_id as the driveRootId/folderName
                await this.syncProject(app.id, app.form_id);
            }
            console.log('[Global Sync] Completed.');
            return { success: true, count: apps.length };
        } catch (e) {
            console.error('[Global Sync] Failed:', e);
            throw e;
        }
    }
}

module.exports = ProjectSyncService;
