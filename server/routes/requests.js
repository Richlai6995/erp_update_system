const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const dbExports = require('../database');

// Helper: Generate Form ID
// Format: [ModuleCode][YYYYMMDD][Seq] (Seq is 4 digits, reset yearly)
function generateFormId(db, moduleCode) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const stmt = db.prepare(`
        SELECT form_id FROM applications 
        WHERE form_id LIKE ? 
        ORDER BY form_id DESC 
        LIMIT 1
    `);
    const lastRec = stmt.get(`${moduleCode}${yyyy}%`);

    let seq = 1;
    if (lastRec) {
        const oldId = lastRec.form_id;
        const oldSeqStr = oldId.slice(-4);
        const oldSeq = parseInt(oldSeqStr, 10);
        if (!isNaN(oldSeq)) {
            seq = oldSeq + 1;
        }
    }

    const seqStr = String(seq).padStart(4, '0');
    return `${moduleCode}${dateStr}${seqStr}`;
}

// GET Search Options (Distinct Form IDs)
router.get('/options', verifyToken, (req, res) => {
    const { db } = dbExports;
    try {
        const formIds = db.prepare('SELECT DISTINCT form_id FROM applications ORDER BY form_id DESC').all();
        res.json({ form_ids: formIds.map(f => f.form_id) });
    } catch (e) {
        console.error('[API Error] /api/requests/options failed:', e);
        res.status(500).json({ error: 'Failed to fetch options', details: e.message });
    }
});

// GET Export CSV
router.get('/export', verifyToken, async (req, res) => {
    console.log('[Export] CSV Export Request received');
    const { db } = dbExports;

    if (!db) {
        console.error('[Export] Database instance is missing!');
        return res.status(500).send('Database not initialized');
    }

    const {
        form_id, start_date, end_date, applicant, department, program_type, file_keyword, status
    } = req.query;

    console.log('[Export] Params:', { form_id, start_date, end_date, applicant, department, program_type, file_keyword, status });

    try {
        let sql = `
            SELECT 
                a.form_id, a.status, a.apply_date, a.program_type, a.db_object_type, a.description, a.dba_comment,
                a.access_db_user, a.access_start_time, a.access_end_time,
                u.name as applicant_name, u.department as applicant_dept,
                m.code as module_code, m.name as module_name,
                f.original_name, f.description as file_desc, f.db_object_type as file_type, 
                f.db_object_name as file_obj_name, f.db_schema_name as file_schema, f.version_type as file_ver,
                f.uploaded_at, f.backup_at, f.backup_file_path
            FROM applications a
            LEFT JOIN users u ON a.applicant_id = u.id
            LEFT JOIN erp_modules m ON a.module_id = m.id
            LEFT JOIN application_files f ON f.application_id = a.id
            WHERE 1=1
        `;

        const params = [];

        // Search Filters
        if (status && status !== 'all') {
            sql += ` AND a.status = ? `;
            params.push(status);
        }
        if (form_id) {
            sql += ` AND a.form_id LIKE ? `;
            params.push(`%${form_id}%`);
        }
        if (start_date) {
            sql += ` AND a.apply_date >= ? `;
            params.push(start_date);
        }
        if (end_date) {
            sql += ` AND a.apply_date <= ? `;
            params.push(end_date + 'T23:59:59.999');
        }
        if (applicant) {
            sql += ` AND u.name LIKE ? `;
            params.push(`%${applicant}%`);
        }
        if (department) {
            sql += ` AND u.department LIKE ? `;
            params.push(`%${department}%`);
        }
        if (program_type) {
            sql += ` AND a.program_type = ? `;
            params.push(program_type);
        }
        if (file_keyword) {
            sql += ` AND EXISTS (
                SELECT 1 FROM application_files f_search 
                WHERE f_search.application_id = a.id 
                AND (f_search.filename LIKE ? OR f_search.original_name LIKE ? OR f_search.description LIKE ?)
            )`;
            const kw = `%${file_keyword}%`;
            params.push(kw, kw, kw);
        }

        sql += ` ORDER BY a.created_at DESC`;

        console.log('[Export] Executing SQL...');
        const rows = db.prepare(sql).all(params);
        console.log(`[Export] Found ${rows.length} rows`);

        // Transform Data
        const statusMap = {
            'draft': '草稿',
            'reviewing': '審核中',
            'manager_rejected': '主管退回',
            'approved': '已核准',
            'dba_rejected': 'DBA退回',
            'online': '已上線',
            'void': '作廢'
        };

        const formatTime = (iso) => {
            if (!iso) return '';
            try {
                return new Date(iso).toLocaleString('zh-TW', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false, timeZone: 'Asia/Taipei'
                }).replace(/\//g, '-');
            } catch (e) { return iso; }
        };

        const formattedRows = rows.map(row => {
            let backupFileName = '';
            if (row.backup_file_path) {
                backupFileName = row.backup_file_path.split(/[/\\]/).pop();
            }

            return {
                ...row,
                status: statusMap[row.status] || row.status,
                apply_date: formatTime(row.apply_date),
                uploaded_at: formatTime(row.uploaded_at),
                backup_at: formatTime(row.backup_at),
                backup_filename: backupFileName,
                access_start_time: formatTime(row.access_start_time),
                access_end_time: formatTime(row.access_end_time)
            };
        });

        console.log('[Export] Require ExcelJS...');
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Requests');

        worksheet.columns = [
            { header: '申請單號', key: 'form_id', width: 20 },
            { header: '狀態', key: 'status', width: 12 },
            { header: '申請日期', key: 'apply_date', width: 20 },
            { header: '申請人', key: 'applicant_name', width: 15 },
            { header: '部門', key: 'applicant_dept', width: 15 },
            { header: '模組', key: 'module_code', width: 10 },
            { header: '類別', key: 'program_type', width: 10 },
            { header: 'DB物件類型', key: 'db_object_type', width: 15 },
            { header: '申請說明', key: 'description', width: 30 },
            { header: 'DBA意見', key: 'dba_comment', width: 20 },
            { header: '檔案名稱', key: 'original_name', width: 25 },
            { header: '檔案說明', key: 'file_desc', width: 20 },
            { header: '上傳日期', key: 'uploaded_at', width: 20 },
            { header: '備份日期', key: 'backup_at', width: 20 },
            { header: '備份檔名', key: 'backup_filename', width: 25 },
            { header: '物件名稱', key: 'file_obj_name', width: 20 },
            { header: 'Schema', key: 'file_schema', width: 15 },
            { header: '檔案版本', key: 'file_ver', width: 10 },
            { header: '檔案物件類型', key: 'file_type', width: 15 },
            // New Fields for Terminal Access
            { header: '目標 DB 帳號', key: 'access_db_user', width: 15 },
            { header: '連線開始時間', key: 'access_start_time', width: 20 },
            { header: '連線結束時間', key: 'access_end_time', width: 20 },
        ];

        formattedRows.forEach(row => {
            worksheet.addRow(row);
        });

        console.log('[Export] Writing to response...');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=requests_export.csv');

        await workbook.csv.write(res);
        console.log('[Export] Complete');
        res.end();

    } catch (e) {
        console.error('[Export] Error:', e);
        res.status(500).send('Export failed: ' + e.message);
    }
});

// GET All Requests with Advanced Search
router.get('/', verifyToken, (req, res) => {
    const { db } = dbExports;
    const {
        form_id,
        start_date,
        end_date,
        applicant,
        department,
        program_type,
        file_keyword
    } = req.query;

    let sql = `
        SELECT a.*, u.name as applicant_name, u.department as applicant_department, m.code as module_code, m.name as module_name
        FROM applications a
        LEFT JOIN users u ON a.applicant_id = u.id
        LEFT JOIN erp_modules m ON a.module_id = m.id
        WHERE 1=1
    `;

    const params = [];

    // Filter by User Role - REMOVED to allow global visibility

    // if (req.user.role === 'user') {
    //     sql += ` AND a.applicant_id = ? `;
    //     params.push(req.user.id);
    // }

    // --- Advanced Search filters ---

    // 1. Form ID
    if (form_id) {
        sql += ` AND a.form_id LIKE ? `;
        params.push(`%${form_id}%`);
    }

    // 2. Date Range
    if (start_date) {
        sql += ` AND a.apply_date >= ? `;
        params.push(start_date);
    }
    if (end_date) {
        sql += ` AND a.apply_date <= ? `;
        params.push(end_date + 'T23:59:59.999'); // Make end date inclusive with ISO string match
    }

    // 3. Applicant Name
    if (applicant) {
        sql += ` AND u.name LIKE ? `;
        params.push(`%${applicant}%`);
    }

    // 4. Department
    if (department) {
        sql += ` AND u.department LIKE ? `;
        params.push(`%${department}%`);
    }

    // 5. Program Type
    if (program_type) {
        sql += ` AND a.program_type = ? `;
        params.push(program_type);
    }

    // 6. File Name / Object Name (Performance Optimization: EXISTS subquery)
    // "檔案清單中的 檔案名稱" or "檔案清單中的 object名稱"
    // We search filename, original_name, and description in application_files
    if (file_keyword) {
        sql += ` AND EXISTS (
            SELECT 1 FROM application_files f 
            WHERE f.application_id = a.id 
            AND (f.filename LIKE ? OR f.original_name LIKE ? OR f.description LIKE ?)
        )`;
        const kw = `%${file_keyword}%`;
        params.push(kw, kw, kw);
    }

    sql += ` ORDER BY a.created_at DESC`;

    console.log('[Search] SQL:', sql);
    console.log('[Search] Params:', params);

    try {
        const rows = db.prepare(sql).all(params);
        res.json(rows);
    } catch (e) {
        console.error('[API Error] /api/requests search failed:', e);
        res.status(500).json({ error: 'Failed to fetch requests', details: e.message });
    }
});

// GET Single Request
router.get('/:id', verifyToken, (req, res) => {
    const { db } = dbExports;
    const { id } = req.params;

    try {
        const app = db.prepare(`
            SELECT a.*, u.name as applicant_name, u.department, m.code as module_code, m.name as module_name
            FROM applications a
            LEFT JOIN users u ON a.applicant_id = u.id
            LEFT JOIN erp_modules m ON a.module_id = m.id
            WHERE a.id = ?
        `).get(id);

        if (!app) return res.status(404).json({ error: 'Request not found' });

        const files = db.prepare(`SELECT * FROM application_files WHERE application_id = ? ORDER BY sequence ASC, uploaded_at ASC`).all(id);
        const reviews = db.prepare(`SELECT * FROM application_reviews WHERE application_id = ? ORDER BY reviewed_at DESC`).all(id);

        let canApprove = false;

        // Use applicant_department from 'u.department' or 'app.department'?
        // The query selects 'a.*, u.name as applicant_name, u.department'.
        // So it is accessible as 'app.department'.

        if (app.status === 'reviewing') {
            if (req.user.role === 'admin') {
                canApprove = true;
            } else if (app.department) {
                const dept = db.prepare('SELECT id FROM departments WHERE name = ?').get(app.department);
                if (dept) {
                    const approvers = db.prepare('SELECT * FROM department_approvers WHERE department_id = ? ORDER BY step_order').all(dept.id);
                    const currentStep = app.current_step || 1;

                    const stepApprovers = approvers.filter(a => a.step_order === currentStep && a.active === 1);

                    if (stepApprovers.some(a => a.user_id == req.user.id)) {
                        canApprove = true;
                    }
                }
            }
        } else {
            if (req.user.role === 'admin') canApprove = true;
        }

        res.json({ ...app, files, reviews, can_approve: canApprove });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch request' });
    }
}); // Fixed missing closing brace/paren


// CREATE Request
router.post('/', verifyToken, (req, res) => {
    const { db } = dbExports;
    const { module_id, program_type, db_object_type, description, agent_flow_id, access_db_user, access_start_time, access_end_time } = req.body;

    if ((!module_id && program_type !== 'Terminal Access') || !program_type) {
        return res.status(400).json({ error: 'Module and Type are required' });
    }

    try {
        let modCode = 'TERM';
        // Get Module Code if module_id exists
        if (module_id) {
            const mod = db.prepare('SELECT code FROM erp_modules WHERE id = ?').get(module_id);
            if (!mod) return res.status(400).json({ error: 'Invalid Module' });
            modCode = mod.code;
        }

        const formId = generateFormId(db, modCode); // Generate ID

        const info = db.prepare(`
            INSERT INTO applications (
                form_id, applicant_id, apply_date, module_id, program_type, db_object_type, description, 
                agent_flow_id, has_tested, status,
                access_db_user, access_start_time, access_end_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
        `).run(
            formId, req.user.id, new Date().toISOString(), module_id || null, program_type, db_object_type, description || '',
            agent_flow_id || null, req.body.has_tested ? 1 : 0,
            access_db_user || null, access_start_time || null, access_end_time || null
        );

        res.json({ id: info.lastInsertRowid, form_id: formId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// UPDATE Request
router.put('/:id', verifyToken, (req, res) => {
    const { db } = dbExports;
    const { id } = req.params;
    const { module_id, program_type, db_object_type, description, has_tested, agent_flow_id, access_db_user, access_start_time, access_end_time } = req.body;

    try {
        const app = db.prepare('SELECT status, applicant_id FROM applications WHERE id = ?').get(id);
        if (!app) return res.status(404).json({ error: 'Request not found' });

        if (!['draft', 'manager_rejected', 'dba_rejected'].includes(app.status) && req.user.role !== 'admin') {
            return res.status(400).json({ error: 'Only drafts or rejected requests can be edited' });
        }

        // Security: Ensure Ownership
        if (app.applicant_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized: You can only edit your own requests' });
        }

        db.prepare(`
            UPDATE applications 
            SET module_id = ?, program_type = ?, db_object_type = ?, description = ?, 
                agent_flow_id = ?, has_tested = ?, 
                access_db_user = ?, access_start_time = ?, access_end_time = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            module_id || null, program_type, db_object_type, description,
            agent_flow_id || null, has_tested ? 1 : 0,
            access_db_user || null, access_start_time || null, access_end_time || null,
            id
        );

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Update failed' });
    }
});

// UPDATE STATUS (Submit / Approve / Online)
router.put('/:id/status', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { action, comment } = req.body;

    try {
        const approvalService = require('../services/approvalService');
        const result = await approvalService.processRequestAction({
            requestId: id,
            user: req.user,
            action: action,
            comment: comment
        });

        res.json(result);
    } catch (e) {
        console.error(e);
        // Handle specific errors for better status codes if needed
        if (e.message === 'Unauthorized' || e.message === 'Unauthorized Approver') {
            return res.status(403).json({ error: e.message });
        }
        if (e.message === 'Request not found') {
            return res.status(404).json({ error: e.message });
        }
        res.status(400).json({ error: e.message || 'Status update failed' });
    }
});

// UPDATE Request Files (Order & Metadata)
router.put('/:id/files', verifyToken, (req, res) => {
    const { db } = dbExports;
    const { id } = req.params;
    const { files } = req.body; // Array of file objects

    try {
        // We run updates sequentially. 
        if (Array.isArray(files)) {
            files.forEach(file => {
                if (file.id) {
                    // Check if backup status changed to update timestamp
                    const current = db.prepare('SELECT is_backup FROM application_files WHERE id = ?').get(file.id);
                    let backupAt = undefined; // undefined means do not update in SQL (if we used dynamic query, but here we use fixed)
                    // We need fixed query. So specific logic:
                    // If is_backup is passed (it should be)
                    const newIsBackup = (file.is_backup === 1 || file.is_backup === true || file.is_backup === '1') ? 1 : 0;

                    // If we want to preserve existing backup_at if newIsBackup is 1 and it was already 1?
                    // Fetch existing backup_at too?
                    // Simplifying: 
                    // If switching 0 -> 1 : Set NOW
                    // If 1 -> 1 : Keep existing (don't change) - BUT how to 'don't change' in fixed SQL?
                    // We can use COALESCE or logic in SQL.
                    // Or read current values.

                    const currentFile = db.prepare('SELECT is_backup, backup_at FROM application_files WHERE id = ?').get(file.id);
                    let newBackupAt = currentFile.backup_at;

                    if (newIsBackup === 1 && currentFile.is_backup !== 1) {
                        newBackupAt = new Date().toISOString();
                    } else if (newIsBackup === 0) {
                        newBackupAt = null;
                    }

                    db.prepare(`
                        UPDATE application_files 
                        SET sequence = ?, description = ?, file_version = ?, db_object_type = ?, db_object_name = ?, db_schema_name = ?,
                            is_backup = ?, backup_at = ?
                        WHERE id = ? AND application_id = ?
                    `).run(
                        file.sequence || 0,
                        file.description || '',
                        file.file_version || file.version_type || 'new',
                        file.db_object_type || null,
                        file.db_object_name || null,
                        file.db_schema_name || null,
                        newIsBackup,
                        newBackupAt,
                        file.id,
                        id
                    );
                }
            });
        }

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Files update failed' });
    }
});

// Delete Application
router.delete('/:id', verifyToken, (req, res) => {
    const { db } = dbExports;
    const { id } = req.params;

    try {
        const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
        if (!app) return res.status(404).json({ error: 'Request not found' });

        if (app.status !== 'draft' && req.user.role !== 'admin') {
            return res.status(400).json({ error: 'Only drafts can be deleted' });
        }

        // Security: Ensure Ownership
        if (app.applicant_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized: You can only delete your own requests' });
        }

        // Files? Should delete physical files too?
        // Ideally yes.
        const files = db.prepare('SELECT file_path FROM application_files WHERE application_id = ?').all(id);
        const fs = require('fs');
        files.forEach(f => {
            if (fs.existsSync(f.file_path)) {
                try { fs.unlinkSync(f.file_path); } catch (e) { }
            }
        });

        db.prepare('DELETE FROM applications WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;
