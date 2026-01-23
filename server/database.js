const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'system.db');

let dbInstance = null;
let SQL = null;

// Helper to save DB to disk atomically
function saveDB() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const tempPath = DB_PATH + '.tmp';

    // Write to temp file first
    fs.writeFileSync(tempPath, buffer);

    // Rename temp to actual (Atomic operation)
    fs.renameSync(tempPath, DB_PATH);
  } catch (e) {
    console.error("Failed to save DB atomically:", e);
  }
}

class DatabaseWrapper {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return new StatementWrapper(this.db, stmt);
  }

  exec(sql) {
    this.db.exec(sql);
    saveDB();
  }
}

class StatementWrapper {
  constructor(db, stmt) {
    this.db = db;
    this.stmt = stmt;
  }

  run(...params) {
    try {
      // Flatten params if array is passed as first arg
      let bindParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
      // Sanitize: sql.js does not like undefined, convert to null
      bindParams = bindParams.map(p => p === undefined ? null : p);

      this.stmt.run(bindParams);

      // Emulate lastInsertRowid
      let lastId = 0;
      try {
        const res = this.db.exec("SELECT last_insert_rowid() as id");
        if (res[0] && res[0].values && res[0].values[0]) {
          lastId = res[0].values[0][0];
        }
      } catch (e) {
        console.warn("Failed to retrieve lastInsertRowid", e);
      }

      saveDB();

      const validChanges = this.db.getRowsModified();
      return { lastInsertRowid: lastId, changes: validChanges };
    } finally {
      this.stmt.free();
    }
  }

  get(...params) {
    const bindParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
    this.stmt.bind(bindParams);
    let result = null;
    if (this.stmt.step()) {
      result = this.stmt.getAsObject();
    }
    this.stmt.free();
    return result;
  }

  all(...params) {
    const bindParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
    this.stmt.bind(bindParams);
    const results = [];
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.free();
    return results;
  }
}

async function initializeDatabase() {
  if (dbInstance) return new DatabaseWrapper(dbInstance);

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(filebuffer);
  } else {
    dbInstance = new SQL.Database();
    saveDB();
  }

  // Check tables
  initSchema(new DatabaseWrapper(dbInstance));

  return new DatabaseWrapper(dbInstance);
}

// Global accessor need to be available after init
let globalDbWrapper = null;

function initSchema(db) {
  // Users (Keep existing)
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    name TEXT,
    email TEXT,
    department TEXT, 
    status TEXT DEFAULT 'active',
    employee_id TEXT,
    start_date TEXT,
    end_date TEXT
  )`);

  // Departments (Keep existing)
  db.exec(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    code TEXT,
    description TEXT,
    active INTEGER DEFAULT 1
  )`);

  // ERP Modules (Keep existing)
  db.exec(`CREATE TABLE IF NOT EXISTS erp_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    code TEXT UNIQUE,
    form_path TEXT,
    report_path TEXT,
    path_code TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // DB Object Types (Keep existing)
  db.exec(`CREATE TABLE IF NOT EXISTS db_object_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  // --- NEW TABLES FOR REWRITE ---

  // 1. Applications (ERP Update Requests)
  db.exec(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id TEXT UNIQUE, -- e.g. GL202601140001
    applicant_id INTEGER,
    apply_date TEXT,
    status TEXT DEFAULT 'draft', -- draft, reviewing, approved, online
    module_id INTEGER,
    program_type TEXT, -- 'form', 'report', 'db_object'
    db_object_type TEXT, -- if program_type is db_object
    description TEXT,
    dba_comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(applicant_id) REFERENCES users(id),
    FOREIGN KEY(module_id) REFERENCES erp_modules(id)
  )`);

  // 2. Application Files
  db.exec(`CREATE TABLE IF NOT EXISTS application_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER,
    filename TEXT,
    original_name TEXT,
    file_path TEXT,
    description TEXT,
    db_object_type TEXT,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
  )`);

  // 3. Application Reviews (Approval Logs)
  db.exec(`CREATE TABLE IF NOT EXISTS application_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER,
    reviewer_id INTEGER,
    reviewer_name TEXT,
    action TEXT, -- 'approve', 'reject'
    comment TEXT,
    reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
  )`);

  // 4. Connection Logs (SQLPlus Terminal Sessions)
  db.exec(`CREATE TABLE IF NOT EXISTS connection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER,
    user_id INTEGER,
    username TEXT,
    start_time TEXT DEFAULT CURRENT_TIMESTAMP,
    end_time TEXT,
    log_filename TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'closed'
    FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
  )`);


  // --- DOCUMENT AUTOMATION TABLES ---

  db.exec(`CREATE TABLE IF NOT EXISTS doc_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    local_path TEXT,
    drive_folder_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    name TEXT,
    drive_folder_id TEXT,
    project_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS doc_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT,
    description TEXT,
    content TEXT,
    template_file TEXT,
    output_format TEXT DEFAULT 'html',
    email_to TEXT,
    email_cc TEXT,
    email_subject TEXT,
    email_from TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES doc_projects(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS doc_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    cron_expression TEXT,
    date_offset INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    last_run_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(template_id) REFERENCES doc_templates(id)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    folder_id INTEGER,
    filename TEXT,
    drive_file_id TEXT,
    mime_type TEXT,
    size INTEGER,
    uploader_id INTEGER,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES doc_projects(id),
    FOREIGN KEY(folder_id) REFERENCES folders(id)
  )`);

  // Seed DB Object Types if empty
  try {
    const defaultObjTypes = ['table', 'view', 'procedure', 'function', 'trigger', 'sequence'];
    defaultObjTypes.forEach(type => {
      db.prepare("INSERT OR IGNORE INTO db_object_types (name) VALUES (?)").run(type);
    });
  } catch (e) {
    console.warn("Seeding DB Object Types failed:", e);
  }

  // Seed Default Admin (Safe Check)
  try {
    const adminCheck = db.prepare("SELECT id FROM users WHERE username = 'ADMIN'").get();
    if (!adminCheck) {
      db.exec(`INSERT INTO users (username, password, role, name, status, department) VALUES ('ADMIN', 'admin', 'admin', 'System Administrator', 'active', 'IT')`);
    }
  } catch (e) {
    console.error("Failed to seed admin:", e);
  }

  // --- MIGRATIONS ---
  // Add status columns to application_files if not exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(application_files)").all();
    const hasDeployedAt = tableInfo.some(c => c.name === 'deployed_at');
    if (!hasDeployedAt) {
      db.exec("ALTER TABLE application_files ADD COLUMN deployed_at TEXT");
      db.exec("ALTER TABLE application_files ADD COLUMN deploy_status TEXT"); // 'success', 'failed'
    }
  } catch (e) { console.error("Migration failed:", e); }

  // Add agent_flow_id to applications if not exists
  try {
    const appTableInfo = db.prepare("PRAGMA table_info(applications)").all();
    const hasAgentFlowId = appTableInfo.some(c => c.name === 'agent_flow_id');
    if (!hasAgentFlowId) {
      db.exec("ALTER TABLE applications ADD COLUMN agent_flow_id TEXT");
    }
  } catch (e) { console.error("Migration agent_flow_id failed:", e); }

  // Add compilation status columns to application_files if not exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(application_files)").all();
    const hasCompiledAt = tableInfo.some(c => c.name === 'compiled_at');
    if (!hasCompiledAt) {
      db.exec("ALTER TABLE application_files ADD COLUMN compiled_at TEXT");
      db.exec("ALTER TABLE application_files ADD COLUMN compile_status TEXT"); // 'success', 'failed'
    }
  } catch (e) { console.error("Migration compilation columns failed:", e); }

  // Add has_tested to applications if not exists
  try {
    const appTableInfo = db.prepare("PRAGMA table_info(applications)").all();
    const hasHasTested = appTableInfo.some(c => c.name === 'has_tested');
    if (!hasHasTested) {
      db.exec("ALTER TABLE applications ADD COLUMN has_tested INTEGER DEFAULT 0");
    }
  } catch (e) { console.error("Migration has_tested failed:", e); }

  // Add current_step to applications if not exists
  try {
    const appTableInfo = db.prepare("PRAGMA table_info(applications)").all();
    const hasCurrentStep = appTableInfo.some(c => c.name === 'current_step');
    if (!hasCurrentStep) {
      db.exec("ALTER TABLE applications ADD COLUMN current_step INTEGER DEFAULT 1");
    }
  } catch (e) { console.error("Migration current_step failed:", e); }

  // Add db_object_type to application_files if not exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(application_files)").all();
    const hasDbObjectType = tableInfo.some(c => c.name === 'db_object_type');
    if (!hasDbObjectType) {
      db.exec("ALTER TABLE application_files ADD COLUMN db_object_type TEXT");
    }
  } catch (e) { console.error("Migration db_object_type failed:", e); }

  // Add file_version to application_files if not exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(application_files)").all();
    const hasFileVersion = tableInfo.some(c => c.name === 'file_version');
    if (!hasFileVersion) {
      db.exec("ALTER TABLE application_files ADD COLUMN file_version TEXT DEFAULT 'new'"); // 'new' or 'backup'
    }
  } catch (e) { console.error("Migration file_version failed:", e); }

  // Add sequence to application_files if not exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(application_files)").all();
    const hasSequence = tableInfo.some(c => c.name === 'sequence');
    if (!hasSequence) {
      db.exec("ALTER TABLE application_files ADD COLUMN sequence INTEGER DEFAULT 0");
    }
  } catch (e) { console.error("Migration sequence failed:", e); }

  // Add backup_at to application_files if not exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(application_files)").all();
    const hasBackupAt = tableInfo.some(c => c.name === 'backup_at');
    if (!hasBackupAt) {
      db.exec("ALTER TABLE application_files ADD COLUMN backup_at TEXT");
    }
  } catch (e) { console.error("Migration backup_at failed:", e); }

  // Add dba_comment to applications if not exists
  try {
    const appTableInfo = db.prepare("PRAGMA table_info(applications)").all();
    if (!appTableInfo.some(c => c.name === 'dba_comment')) {
      db.exec("ALTER TABLE applications ADD COLUMN dba_comment TEXT");
    }
  } catch (e) { console.error("Migration dba_comment failed:", e); }

  // Add Terminal Access columns to applications if not exists
  try {
    const appTableInfo = db.prepare("PRAGMA table_info(applications)").all();

    if (!appTableInfo.some(c => c.name === 'access_db_user')) {
      db.exec("ALTER TABLE applications ADD COLUMN access_db_user TEXT");
    }
    if (!appTableInfo.some(c => c.name === 'access_start_time')) {
      db.exec("ALTER TABLE applications ADD COLUMN access_start_time TEXT");
    }
    if (!appTableInfo.some(c => c.name === 'access_end_time')) {
      db.exec("ALTER TABLE applications ADD COLUMN access_end_time TEXT");
    }
  } catch (e) { console.error("Migration terminal columns failed:", e); }

  // Department Approvers Table
  db.exec(`CREATE TABLE IF NOT EXISTS department_approvers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER,
    step_order INTEGER,
    user_id INTEGER,
    username TEXT,
    notify INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE
  )`);

  // Add Proxy Columns to department_approvers
  try {
    const daTableInfo = db.prepare("PRAGMA table_info(department_approvers)").all();
    if (!daTableInfo.some(c => c.name === 'proxy_user_id')) {
      db.exec("ALTER TABLE department_approvers ADD COLUMN proxy_user_id INTEGER");
      db.exec("ALTER TABLE department_approvers ADD COLUMN proxy_start_date TEXT");
      db.exec("ALTER TABLE department_approvers ADD COLUMN proxy_end_date TEXT");
    }
  } catch (e) { console.error("Migration proxy columns failed:", e); }
}

const dbExports = {
  db: null,
  init: async () => {
    globalDbWrapper = await initializeDatabase();
    dbExports.db = globalDbWrapper;
    return globalDbWrapper;
  },
  reload: async () => {
    console.log("Reloading Database from disk...");
    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      if (dbInstance) dbInstance.close();
      dbInstance = new SQL.Database(filebuffer);
      globalDbWrapper = new DatabaseWrapper(dbInstance);
      dbExports.db = globalDbWrapper;
      initSchema(globalDbWrapper);
      return true;
    }
    return false;
  }
};

module.exports = dbExports;
