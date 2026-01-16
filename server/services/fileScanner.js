const fs = require('fs');
const path = require('path');

const { glob } = require('glob');

// glob v13+ returns a Promise directly, so we don't need promisify
const globPromise = glob;

class FileScanner {
    /**
     * Find a file matching the criteria.
     * @param {string} projectRoot - The absolute path to the project root.
     * @param {string} dateFolder - The specific date folder name (e.g., "2025-01-08") or null.
     * @param {string} searchPath - The sub-path to search in (e.g., "/" or "/BUILD").
     * @param {string} pattern - The filename pattern (e.g., "MP*.jpg").
     * @returns {Promise<string|null>} - The absolute path of the found file, or null.
     */
    static async findFile(projectRoot, dateFolder, searchPath, pattern) {
        // Construct the base directory for the search
        // If dateFolder is provided, we assume the structure is projectRoot/dateFolder/searchPath
        // If searchPath starts with "/", it is relative to the dateFolder (if present) or projectRoot

        // Clean inputs
        const cleanSearchPath = (searchPath || '').replace(/^[\\/]/, ''); // remove leading slash

        let searchBase = projectRoot;

        if (dateFolder) {
            searchBase = path.join(searchBase, dateFolder);
        }

        searchBase = path.join(searchBase, cleanSearchPath);

        // Ensure the directory exists
        if (!fs.existsSync(searchBase)) {
            console.log(`Directory not found: ${searchBase}`);
            return null;
        }

        // Construct glob pattern
        // pattern should be something like "*.jpg" or "MP*.txt"
        // We want case-insensitive matching
        const globOptions = {
            cwd: searchBase,
            nocase: true,
            absolute: true,
            nodir: true // only match files
        };

        try {
            const files = await globPromise(pattern, globOptions);
            if (files && files.length > 0) {
                // Return the first match
                return files[0];
            }
        } catch (error) {
            console.error('Error finding file:', error);
        }

        return null;
    }
}

module.exports = FileScanner;
