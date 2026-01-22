const nodemailer = require('nodemailer');
const dbWrapper = require('../database');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// JWT Secret - Should be in ENV, fallback for dev
const JWT_SECRET = process.env.JWT_SECRET || 'erp_update_system_secret_key_2024';
const API_URL = process.env.API_URL || 'http://localhost:3000'; // Backend URL

// Helper: Generate Magic Link Token (Valid for 7 days)
function generateApprovalToken(userId, requestId, action) {
    return jwt.sign({ userId, requestId, action }, JWT_SECRET, { expiresIn: '7d' });
}

// Helper to extract base64 images and convert to CIDs
function processHtmlImages(html) {
    const attachments = [];
    const processedHtml = html.replace(/src=["']data:image\/([a-zA-Z]+);base64,([^"']+)["']/g, (match, type, data) => {
        // Generate valid CID
        const cid = `img_${Date.now()}_${Math.random().toString(36).substring(2)}@vibe_coding`;
        attachments.push({
            filename: `image.${type}`,
            content: data,
            encoding: 'base64',
            cid: cid
        });
        return `src="cid:${cid}"`;
    });
    return { html: processedHtml, attachments };
}

// Helper to check if HTML is complete
function isHtmlComplete(htmlContent) {
    if (!htmlContent) return false;
    // Relaxed check: Just ensure </html> exists. 
    // DocGenerator appends comments after </html>, so we shouldn't fail on that.
    return /<\/html>/i.test(htmlContent);
}

async function getSystemSetting(key, defaultValue) {
    const db = await dbWrapper.init(); // Ensure init
    const res = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
    return res ? res.value : defaultValue;
}

async function logMail(executor, fileName, recipient, subject, status, message, projectName, pathInfo, htmlComplete, scheduleId) {
    try {
        const db = await dbWrapper.init();
        const recipientStr = Array.isArray(recipient) ? recipient.join(', ') : (recipient || '');

        db.prepare(`
      INSERT INTO mail_logs (executor, file_name, recipient, subject, status, message, project_name, path_info, html_complete, schedule_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(executor, fileName, recipientStr, subject, status, message, projectName || '', pathInfo || '', htmlComplete ? 'Yes' : 'No', scheduleId || null);
    } catch (e) {
        console.error("Failed to log mail:", e);
    }

    // Trigger lazy auto-cleanup (fire and forget or await? let's await to be safe with DB locks)
    // To avoid running it EVERY time if high volume, we could do Math.random() < 0.1
    // But for this use case, every time is fine.
    await cleanupOldLogs();
}

async function sendEmail({
    from,
    to,
    cc,
    subject,
    html,
    attachments = [],
    executor = 'System',
    fileName = 'Generated Document',
    projectName = '',
    pathInfo = '',
    scheduleId = null
}) {
    // 1. Check if mail server is enabled
    const isEnabled = await getSystemSetting('mail_server_enabled', 'true');
    if (isEnabled === 'false') {
        const msg = 'Mail server is disabled/paused by admin.';
        await logMail(executor, fileName, to, subject, 'failed', msg, projectName, pathInfo, false, scheduleId);
        throw new Error('Mail server is currently disabled.');
    }

    // 2. Check HTML completeness
    const isComplete = isHtmlComplete(html);
    if (!isComplete) {
        const msg = 'Document is incomplete (missing closing html tag).';
        await logMail(executor, fileName, to, subject, 'failed', msg, projectName, pathInfo, false, scheduleId);
        throw new Error(msg);
    }

    // 3. Configure Transporter
    // Using env vars as requested
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_SERVER || 'dp-notes.foxlink.com.tw',
        port: parseInt(process.env.SMTP_PORT || '25'),
        secure: false, // Port 25 usually not secure or STARTTLS
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        },
        tls: {
            rejectUnauthorized: false // Often needed for internal servers with self-signed certs
        }
    });

    const defaultFrom = process.env.SENDER_ADDRESS || process.env.FROM_ADDRESS || 'Rich_lai@foxlink.com';
    const fromAddress = (from && from.trim()) ? from.trim() : defaultFrom;


    // 3. Process HTML Images (Base64 -> CID)
    const { html: processedHtml, attachments: imageAttachments } = processHtmlImages(html);

    // Merge existing attachments with new image attachments
    const finalAttachments = [...attachments, ...imageAttachments];

    const mailOptions = {
        from: fromAddress,
        to: to, // array or comma separated string
        cc: cc, // array or comma separated string
        subject: subject,
        html: processedHtml,
        attachments: finalAttachments // array of { filename, content | path }
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        await logMail(executor, fileName, to, subject, 'success', `Sent successfully. Filtered Info: ${info.messageId}`, projectName, pathInfo, true, scheduleId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        await logMail(executor, fileName, to, subject, 'failed', error.message, projectName, pathInfo, true, scheduleId);
        throw error;
    }
}

// Log Management
async function setRetentionDays(days) {
    const db = await dbWrapper.init();
    const val = days.toString();
    const existing = db.prepare("SELECT key FROM system_settings WHERE key = 'mail_log_retention_days'").get();
    if (existing) {
        db.prepare("UPDATE system_settings SET value = ? WHERE key = 'mail_log_retention_days'").run(val);
    } else {
        db.prepare("INSERT INTO system_settings (key, value) VALUES ('mail_log_retention_days', ?)").run(val);
    }
}

async function getRetentionDays() {
    return parseInt(await getSystemSetting('mail_log_retention_days', '30'));
}

async function clearLogs(beforeDate = null) {
    const db = await dbWrapper.init();
    if (beforeDate) {
        // Delete logs created strictly before this date
        // created_at is TEXT 'YYYY-MM-DD HH:MM:SS'
        // If beforeDate is '2025-01-01', we delete where created_at < '2025-01-01'
        const result = db.prepare("DELETE FROM mail_logs WHERE created_at < ?").run(beforeDate);
        return result.changes;
    } else {
        // Clear all
        const result = db.prepare("DELETE FROM mail_logs").run();
        return result.changes;
    }
}

async function cleanupOldLogs() {
    try {
        const days = await getRetentionDays();
        if (days > 0) {
            const date = new Date();
            date.setDate(date.getDate() - days);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            console.log(`Auto-cleaning mail logs older than ${days} days (before ${dateStr})...`);
            await clearLogs(dateStr);
        }
    } catch (e) {
        console.error("Auto-cleanup failed:", e);
    }
}

async function exportLogs(startDate, endDate) {
    const db = await dbWrapper.init();
    let query = "SELECT * FROM mail_logs WHERE 1=1";
    const params = [];

    if (startDate) {
        query += " AND created_at >= ?";
        params.push(startDate + " 00:00:00");
    }
    if (endDate) {
        query += " AND created_at <= ?";
        params.push(endDate + " 23:59:59");
    }

    query += " ORDER BY created_at DESC";

    const logs = db.prepare(query).all(...params);

    // Generate CSV content
    const header = ['Time', 'Executor', 'Project', 'Path', 'Filename', 'Recipient', 'Status', 'HTML Complete', 'Message'];
    const rows = logs.map(log => [
        log.created_at,
        log.executor,
        log.project_name || '',
        log.path_info || '',
        log.file_name || '',
        log.recipient,
        log.status,
        log.html_complete,
        log.message
    ]);

    // Helper to escape CSV fields
    const escapeCsv = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str).replace(/"/g, '""'); // Escape double quotes
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s}"`;
        }
        return s;
    };

    const csvContent = [
        header.join(','),
        ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\r\n');

    // Add BOM for Excel UTF-8 compatibility
    return '\ufeff' + csvContent;
}

// Notification Logic

async function getRecipientsByRole(roleCriteria) {
    const db = await dbWrapper.init();
    // roleCriteria can be a string (exact match) or function
    // For simplicity, let's just fetch all users and filter in JS if complex, 
    // or use specific SQL.
    const users = db.prepare("SELECT email, role, name FROM users WHERE status = 'active' AND email IS NOT NULL").all();

    // Filter
    const recipients = users.filter(u => {
        if (typeof roleCriteria === 'function') return roleCriteria(u.role);
        if (roleCriteria === 'manager') return u.role === 'manager' || u.role === 'admin'; // Admin gets everything usually?
        if (roleCriteria === 'dba') return (u.role && u.role.toLowerCase().includes('dba')) || u.role === 'admin';
        return u.role === roleCriteria;
    });

    return recipients.map(u => u.email).filter(e => e); // Return emails
}

function generateActionButtons(approveLink, rejectLink) {
    if (!approveLink && !rejectLink) return '';

    return `
    <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border: 1px dashed #ccc; text-align: center; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #555;">快速簽核 (Quick Action)</h3>
        <p style="font-size: 14px; color: #666; margin-bottom: 15px;">您可以在此直接核准或退回申請單，無需登入系統。</p>
        
        <div style="display: flex; justify-content: center; gap: 20px;">
            <a href="${approveLink}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                ✅ 核准 (Approve)
            </a>
            
            <a href="${rejectLink}" style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                ❌ 退回 (Reject)
            </a>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 15px;">此連結有效期為 7 天。</p>
    </div>
    `;
}

function generateEmailHtml(request, files, actionLinks = {}) {
    // request: { form_id, applicant_name, apply_date, module_code, program_type, agent_flow_id, description }
    // files: [{ original_name, description, db_object_type, file_version }]

    const fileRows = files.map(f => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${f.original_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${f.db_object_type || '-'}</td>
             <td style="padding: 8px; border: 1px solid #ddd;">${f.file_version === 'backup' ? '正式環境備份' : '新程式'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${f.description || ''}</td>
        </tr>
    `).join('');

    const actionButtons = generateActionButtons(actionLinks.approve, actionLinks.reject);

    return `
<!DOCTYPE html>
<html>
<head>
<style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #f4f6f8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .header-item { margin-bottom: 5px; }
    .label { font-weight: bold; color: #555; display: inline-block; width: 140px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background-color: #eee; text-align: left; padding: 8px; border: 1px solid #ddd; }
    .footer { margin-top: 30px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
    <h2>ERP 申請單通知</h2>
    
    <div class="header">
        <div class="header-item"><span class="label">申請單 (Form ID):</span> ${request.form_id}</div>
        <div class="header-item"><span class="label">申請人 (Applicant):</span> ${request.applicant_name}</div>
        <div class="header-item"><span class="label">申請日期 (Date):</span> ${new Date(request.apply_date).toLocaleString('zh-TW', { hour12: false })}</div>
        <div class="header-item"><span class="label">模組 (Module):</span> ${request.module_code}</div>
        <div class="header-item"><span class="label">程式類別 (Type):</span> ${request.program_type}</div>
        <div class="header-item"><span class="label">Notes 單號:</span> ${request.agent_flow_id || 'N/A'}</div>
        <div class="header-item"><span class="label">申請說明:</span> ${request.description || '無'}</div>
    </div>

    <h3>程式檔案列表 (Files)</h3>
    <table>
        <thead>
            <tr>
                <th>檔名 (Filename)</th>
                <th>物件類別 (Object Type)</th>
                 <th>檔案版本 (Version)</th>
                <th>說明 (Description)</th>
            </tr>
        </thead>
        <tbody>
            ${fileRows.length > 0 ? fileRows : '<tr><td colspan="4">無檔案</td></tr>'}
        </tbody>
    </table>

    ${actionButtons}

    <div style="margin-top: 20px; text-align: center;">
        <a href="${process.env.APP_URL || 'http://localhost:5173'}/requests/${request.id}" 
           style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           查看申請單 (View Request)
        </a>
    </div>

    <div class="footer">
        此郵件由系統自動發送，請勿直接回覆。<br>
        ERP Update System
    </div>
</body>
</html>
    `;
}

// Notify Signer (Manager or Specific Approver)
async function sendSignerNotification(requestId, executorName, nextApproverId = null) {
    const db = await dbWrapper.init();
    // Fetch detailed request info
    const request = db.prepare(`
        SELECT r.*, u.name as applicant_name, m.code as module_code
        FROM applications r
        LEFT JOIN users u ON r.applicant_id = u.id
        LEFT JOIN erp_modules m ON r.module_id = m.id
        WHERE r.id = ?
    `).get(requestId);

    if (!request) return;

    const files = db.prepare(`SELECT * FROM application_files WHERE application_id = ?`).all(requestId);


    let recipients = [];
    let approverUser = null;

    if (nextApproverId) {
        // Specific Approver (Flow-Based)
        approverUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(nextApproverId);
        if (approverUser && approverUser.email) {
            recipients.push(approverUser.email);
        }
    } else {
        // Fallback: Notify 'manager' role (Legacy) - Hard to generate token for group...
        // Maybe we just don't offer magic links for broadcast emails, or we generate one for 'admin'? 
        // Logic says we usually have specific approver now.
        recipients = await getRecipientsByRole('manager');
        // If broadcast, we can't easily make a user-specific token unless we iterate.
        // For simplicity, if broadcast, no magic links? Or magic link with generic user?
        // Let's safe-guard: if !approverUser, no action links.
    }

    // Generate Magic Links if single approver
    let actionLinks = {};
    if (approverUser) {
        const approveToken = generateApprovalToken(approverUser.id, request.id, 'approve');
        const rejectToken = generateApprovalToken(approverUser.id, request.id, 'reject');

        actionLinks = {
            approve: `${API_URL}/api/public/approve?token=${approveToken}`,
            reject: `${API_URL}/api/public/reject?token=${rejectToken}` // Reject usually needs comment, so this might redirect to a form?
            // For simplify: GET reject -> Updates status to rejected (no comment) or shows a simple HTML form?
            // The implementation plan mainly said "Approve/Reject". 
            // If we want comment, the link should open a page with a box. 
            // For now, let's make it a direct reject or a page that asks for confirmation? 
            // Let's assume direct for MVP, or better, the link goes to a page that renders the form.
            // Wait, `processRequestAction` takes a comment.
            // If I just GET /api/public/reject, it will reject with empty comment.
        };
    }

    const html = generateEmailHtml(request, files, actionLinks);
    const subject = `ERP程式變更申請[待簽核通知] 申請單: ${request.form_id} - ${request.module_code} (${request.applicant_name})`;

    if (recipients.length === 0) {
        console.warn('No Signer recipients found.');
        return;
    }

    await sendEmail({
        to: recipients,
        subject: subject,
        html: html,
        executor: executorName || 'System',
        fileName: request.program_type || 'Form', // Program Type
        projectName: request.form_id,     // Application ID
        pathInfo: '通知簽核人'             // Mail Category
    });
}

// Notify DBA (Approved)
async function sendDBANotification(requestId, executorName) {
    const db = await dbWrapper.init();
    const request = db.prepare(`
        SELECT r.*, u.name as applicant_name, m.code as module_code
        FROM applications r
        LEFT JOIN users u ON r.applicant_id = u.id
        LEFT JOIN erp_modules m ON r.module_id = m.id
        WHERE r.id = ?
    `).get(requestId);

    if (!request) return;

    const files = db.prepare(`SELECT * FROM application_files WHERE application_id = ?`).all(requestId);

    // Logic: Notify users with 'dba' in role (Or Admin)
    // Multicast. We can't generate unique tokens for everyone in one email.
    // So no magic links for DBA broadcast. They should log in to execute DDL anyway.
    const html = generateEmailHtml(request, files);
    const subject = `ERP程式變更申請[待執行通知] 申請單: ${request.form_id} - 已核准 (${request.module_code})`;

    const recipients = await getRecipientsByRole('dba');
    if (recipients.length === 0) {
        console.warn('No DBA recipients found.');
        return;
    }

    await sendEmail({
        to: recipients,
        subject: subject,
        html: html,
        executor: executorName || 'System',
        fileName: request.program_type || 'Form', // Program Type
        projectName: request.form_id,     // Application ID
        pathInfo: '通知DBA'               // Mail Category
    });
}

// Notify Applicant (Reject / Online)
async function sendApplicantNotification(requestId, type, comment) {
    const db = await dbWrapper.init();
    const request = db.prepare(`
        SELECT r.*, u.name as applicant_name, u.email as applicant_email, m.code as module_code
        FROM applications r
        LEFT JOIN users u ON r.applicant_id = u.id
        LEFT JOIN erp_modules m ON r.module_id = m.id
        WHERE r.id = ?
    `).get(requestId);

    if (!request || !request.applicant_email) return;

    const files = db.prepare(`SELECT * FROM application_files WHERE application_id = ?`).all(requestId);
    const html = generateEmailHtml(request, files);

    let subject = '';
    let statusMsg = '';

    if (type === 'reject') {
        subject = `ERP程式變更申請[申請退回] 申請單: ${request.form_id} - ${request.module_code}`;
        statusMsg = `您的申請單已被退回。原因: ${comment || '無'}`;
    } else if (type === 'online') {
        subject = `ERP程式變更申請[已上線] 申請單: ${request.form_id} - ${request.module_code}`;
        statusMsg = `您的申請單已完成並上線。備註: ${comment || '無'}`;
    } else {
        subject = `ERP程式變更申請[申請單通知] 申請單: ${request.form_id}`;
        statusMsg = `通知: ${comment || ''}`;
    }

    // Prepend status message to HTML body for context
    const modifiedHtml = html.replace('<body>', `<body><div style="padding: 15px; background-color: #fff3cd; border: 1px solid #ffeeba; margin-bottom: 20px; color: #856404;"><strong>${statusMsg}</strong></div>`);

    await sendEmail({
        to: request.applicant_email,
        subject: subject,
        html: modifiedHtml,
        executor: 'System',
        fileName: request.program_type || 'Form',
        projectName: request.form_id,
        pathInfo: `通知申請人 (${type})`
    });
}

async function scheduleCleanupTask() {
    // Default to run daily at 3 AM if not set, but user might want more frequent
    console.log('[MailService] Initializing Cleanup Schedule...');
    const cron = require('node-cron');

    // We could store this frequency in DB too, but for now hardcoded to every hour as requested or default
    // Let's check DB for 'mail_log_cleanup_cron'
    const cronExp = await getSystemSetting('mail_log_cleanup_cron', '0 * * * *'); // Default: Every hour (minute 0)

    console.log(`[MailService] Scheduling Log Cleanup with cron: ${cronExp}`);
    cron.schedule(cronExp, async () => {
        console.log('[MailService] Executing Scheduled Log Cleanup...');
        await cleanupOldLogs();
    });
}

// Notify Original Approver (When Proxy signs)
async function sendProxyNotification(requestId, originalApproverUsername, proxyName, originalApproverId) {
    const db = await dbWrapper.init();

    // Get Original Approver Email
    let approver = null;
    if (originalApproverId) {
        approver = db.prepare('SELECT email, name FROM users WHERE id = ?').get(originalApproverId);
    } else if (originalApproverUsername) {
        approver = db.prepare('SELECT email, name FROM users WHERE username = ?').get(originalApproverUsername);
    }

    if (!approver || !approver.email) {
        console.warn(`[Mail] Cannot notify proxy target ${originalApproverUsername}: No email found.`);
        return;
    }

    const request = db.prepare(`
        SELECT r.*, u.name as applicant_name, m.code as module_code
        FROM applications r
        LEFT JOIN users u ON r.applicant_id = u.id
        LEFT JOIN erp_modules m ON r.module_id = m.id
        WHERE r.id = ?
    `).get(requestId);

    if (!request) return;

    const files = db.prepare(`SELECT * FROM application_files WHERE application_id = ?`).all(requestId);
    const html = generateEmailHtml(request, files); // Reuse base HTML

    // Add specific message
    const msg = `您的代理人 <strong>${proxyName}</strong> 已代您完成了此申請單的簽核。`;
    const modifiedHtml = html.replace('<body>', `<body><div style="padding: 15px; background-color: #e0f2fe; border: 1px solid #bae6fd; margin-bottom: 20px; color: #0369a1;"><strong>${msg}</strong></div>`);

    const subject = `ERP程式變更申請[代理簽核通知] 申請單: ${request.form_id} (由 ${proxyName} 代理)`;

    await sendEmail({
        to: approver.email,
        subject: subject,
        html: modifiedHtml,
        executor: 'System',
        fileName: request.program_type || 'Form',
        projectName: request.form_id,
        pathInfo: '通知代理主審核人'
    });
}

module.exports = {
    sendEmail,
    setRetentionDays,
    getRetentionDays,
    clearLogs,
    cleanupOldLogs,
    exportLogs,
    sendSignerNotification,
    sendDBANotification,
    sendApplicantNotification,
    sendProxyNotification,
    scheduleCleanupTask
};
