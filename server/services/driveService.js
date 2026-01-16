const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config/system.yaml');
const DEFAULT_FILES_ROOT = path.join(__dirname, '..', 'local_storage');

const getFilesRoot = () => {
    // 1. Environment Variable (Highest Priority)
    if (process.env.FILES_DIR) return process.env.FILES_DIR;
    if (process.env.FILES_ROOT_DIR) return process.env.FILES_ROOT_DIR;

    // 2. Try to read from config/system.yaml
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const content = fs.readFileSync(CONFIG_PATH, 'utf8');
            // Look for 'files_dir: "path"' or "files_dir: 'path'"
            const match = content.match(/files_dir:\s*["']?([^"'\r\n]+)["']?/);
            if (match && match[1]) {
                const configPath = match[1].trim();
                // If it's a valid path, use it
                if (configPath) return configPath;
            }
        }
    } catch (e) {
        console.error("Failed to read config/system.yaml for FILES_DIR", e);
    }

    // 3. Fallback
    return DEFAULT_FILES_ROOT;
};

const FILES_ROOT = getFilesRoot();

// Ensure root exists
if (!fs.existsSync(FILES_ROOT)) {
    console.log(`Creating root storage directory: ${FILES_ROOT}`);
    try {
        fs.mkdirSync(FILES_ROOT, { recursive: true });
    } catch (e) {
        console.error(`Failed to create root dir ${FILES_ROOT}:`, e);
    }
}

// Helper to get full path
const getFullPath = (relativePath) => {
    if (!relativePath) return FILES_ROOT;
    // Normalize Windows backslashes to forward slashes for Linux/Docker compatibility
    const normalized = relativePath.replace(/\\/g, '/');
    const fullPath = path.join(FILES_ROOT, normalized);

    // Security Confinement Check
    const rel = path.relative(FILES_ROOT, fullPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`[Security] Path Traversal Detected: Access denied to ${relativePath}`);
    }
    return fullPath;
};

const createFolder = async (folderName, editors = [], parentFolderId = null) => {
    try {
        const parentPath = getFullPath(parentFolderId);
        const newFolderPath = path.join(parentPath, folderName);

        if (!fs.existsSync(newFolderPath)) {
            await fsPromises.mkdir(newFolderPath, { recursive: true });
            return { folderId: path.relative(FILES_ROOT, newFolderPath), existed: false };
        } else {
            return { folderId: path.relative(FILES_ROOT, newFolderPath), existed: true };
        }
    } catch (error) {
        console.error('Local FS Create Folder Error:', error);
        throw error;
    }
};

const uploadFile = async (base64Content, fileName, mimeType, parentFolderId) => {
    try {
        const parentPath = getFullPath(parentFolderId);

        if (!fs.existsSync(parentPath)) {
            await fsPromises.mkdir(parentPath, { recursive: true });
        }

        const filePath = path.join(parentPath, fileName);
        let finalFileName = fileName;
        let finalPath = filePath;
        let counter = 1;

        while (fs.existsSync(finalPath)) {
            const ext = path.extname(fileName);
            const name = path.basename(fileName, ext);
            finalFileName = `${name}_${counter}${ext}`;
            finalPath = path.join(parentPath, finalFileName);
            counter++;
        }

        const buffer = Buffer.from(base64Content, 'base64');
        await fsPromises.writeFile(finalPath, buffer);

        return path.relative(FILES_ROOT, finalPath);
    } catch (error) {
        console.error('Local FS Upload Error:', error);
        throw error;
    }
};

const getFileContent = async (fileId) => {
    try {
        const fullPath = getFullPath(fileId);
        if (fs.existsSync(fullPath)) {
            const buffer = await fsPromises.readFile(fullPath);
            return buffer;
        } else {
            throw new Error(`File not found: ${fileId}`);
        }
    } catch (error) {
        console.error('Local FS Read Error:', error);
        throw error;
    }
};

const ensurePath = async (pathString) => {
    try {
        const fullPath = getFullPath(pathString);
        if (!fs.existsSync(fullPath)) {
            await fsPromises.mkdir(fullPath, { recursive: true });
        }
        return { folderId: pathString };
    } catch (error) {
        console.error('Local FS Ensure Path Error:', error);
        throw error;
    }
};

const renameFolder = async (folderId, newName) => {
    try {
        const oldPath = getFullPath(folderId);
        const parentDir = path.dirname(oldPath);
        const newPath = path.join(parentDir, newName);

        if (fs.existsSync(newPath)) {
            throw new Error('Destination already exists');
        }

        await fsPromises.rename(oldPath, newPath);
        return { success: true, folderId: path.relative(FILES_ROOT, newPath) };
    } catch (error) {
        console.error('Local FS Rename Error:', error);
        throw error;
    }
};

const deleteFolder = async (folderId) => {
    const fullPath = getFullPath(folderId);

    try {
        if (path.relative(FILES_ROOT, fullPath) === '') {
            console.error("[LocalFS] Attempted to delete ROOT directory. Blocked.");
            return { success: false, error: 'Cannot delete root directory' };
        }

        const rel = path.relative(FILES_ROOT, fullPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            console.error(`[LocalFS] Attempted path traversal: ${fullPath}`);
            return { success: false, error: 'Invalid path' };
        }

        if (fs.existsSync(fullPath)) {
            await fsPromises.rm(fullPath, { recursive: true, force: true });
        } else {
            // benign issue, no log
        }
        return { success: true };
    } catch (error) {
        console.error('Local FS Delete Folder Error:', error);
        return { success: false, error: error.message };
    }
};

const deleteFile = async (fileId) => {
    const fullPath = getFullPath(fileId);
    try {
        if (fs.existsSync(fullPath)) {
            await fsPromises.unlink(fullPath);
        }
        return { success: true };
    } catch (error) {
        console.error('Local FS Delete File Error:', error);
        return { success: false, error: error.message };
    }
};

const listFiles = async (folderId) => {
    try {
        const fullPath = getFullPath(folderId);
        if (!fs.existsSync(fullPath)) {
            return { files: [], folders: [] };
        }

        const items = await fsPromises.readdir(fullPath, { withFileTypes: true });
        const files = [];
        const folders = [];

        for (const item of items) {
            const itemFullPath = path.join(fullPath, item.name);
            if (item.isDirectory()) {
                folders.push({
                    id: path.relative(FILES_ROOT, itemFullPath),
                    name: item.name
                });
            } else {
                // Get stats for file
                const stats = await fsPromises.stat(itemFullPath);
                files.push({
                    id: path.relative(FILES_ROOT, itemFullPath),
                    name: item.name,
                    size: stats.size,
                    mtime: stats.mtime.toISOString(), // ISO String for DB
                });
            }
        }
        return { files, folders };
    } catch (error) {
        console.error('Local FS List Files Error:', error);
        throw error;
    }
};

module.exports = { createFolder, uploadFile, getFileContent, ensurePath, renameFolder, deleteFolder, deleteFile, listFiles };
