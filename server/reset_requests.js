const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Config
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'system.db');

async function resetRequests() {
    console.log(`[Cleaner] Opening database: ${DB_PATH}`);

    if (!fs.existsSync(DB_PATH)) {
        console.error("Database file found!");
        process.exit(1);
    }

    const filebuffer = fs.readFileSync(DB_PATH);
    const SQL = await initSqlJs();
    const db = new SQL.Database(filebuffer);

    console.log("[Cleaner] Deleting data from: application_files, application_reviews, applications...");

    try {
        // Execute Transaction
        db.exec("BEGIN TRANSACTION");

        // Order matters due to Foreign Keys (though SQLite allows disable, better safe)
        db.exec("DELETE FROM application_files");
        db.exec("DELETE FROM application_reviews");
        db.exec("DELETE FROM applications");

        // Reset Auto Increment Counters (Optional but good for 'Clean Slate')
        // Check if sqlite_sequence exists
        const seqExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'");
        if (seqExists.length > 0) {
            console.log("[Cleaner] Resetting ID counters...");
            db.exec("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'applications'");
            db.exec("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'application_files'");
            db.exec("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'application_reviews'");
        }

        db.exec("COMMIT");
        console.log("[Cleaner] Data cleared successfully.");

        // Save back to disk
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
        console.log("[Cleaner] Database saved.");

    } catch (err) {
        console.error("[Cleaner] Error:", err);
        db.exec("ROLLBACK");
    } finally {
        db.close();
    }
}

resetRequests();
