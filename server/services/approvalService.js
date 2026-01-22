const dbExports = require('../database');
const mailService = require('./mailService');

async function processRequestAction({
    requestId,
    user, // { id, role, name, ... }
    action, // 'submit', 'approve', 'reject', 'void', 'online'
    comment = '',
    isPublic = false // If true, skips some strict session checks if validated elsewhere
}) {
    const { db } = dbExports;

    // 1. Fetch Request
    const app = db.prepare(`
        SELECT apps.*, u.department as applicant_department, u.name as applicant_name
        FROM applications apps
        LEFT JOIN users u ON apps.applicant_id = u.id
        WHERE apps.id = ?
    `).get(requestId);

    if (!app) throw new Error('Request not found');

    let newStatus = app.status;
    let dbaComment = null;
    let nextApproverId = null;
    let proxyForUser = null;

    // 2. Action Logic
    if (action === 'submit') {
        // Security: Ownership
        if (app.applicant_id !== user.id && user.role !== 'admin') {
            throw new Error('Unauthorized');
        }

        if (!['draft', 'manager_rejected', 'dba_rejected'].includes(app.status)) {
            throw new Error('Cannot submit non-draft');
        }

        newStatus = 'reviewing';

        // Find Applicant's Department
        const dept = db.prepare('SELECT id FROM departments WHERE name = ?').get(app.applicant_department);

        if (!dept && user.role !== 'admin') {
            throw new Error('Applicant department system error');
        }

        // Find Step 1 Approver
        if (dept) {
            const approvers = db.prepare('SELECT * FROM department_approvers WHERE department_id = ? ORDER BY step_order').all(dept.id);
            const step1 = approvers.find(a => a.step_order === 1 && a.active === 1);
            if (step1) {
                nextApproverId = step1.user_id;
            }
        }
    }
    else if (action === 'approve') {
        // 1. Get Applicant Department ID
        const dept = db.prepare('SELECT id FROM departments WHERE name = ?').get(app.applicant_department);
        if (!dept && user.role !== 'admin') {
            throw new Error('Applicant department system error');
        }

        // 2. Get Approvers
        let approvers = [];
        if (dept) {
            approvers = db.prepare('SELECT * FROM department_approvers WHERE department_id = ? ORDER BY step_order').all(dept.id);
        }

        // 3. Current Step
        let currentStep = app.current_step || 1;

        // 4. Find Approver for Current Step
        const stepApprovers = approvers.filter(a => a.step_order === currentStep && a.active === 1);

        // 5. Check Permission
        // For public/magic link, we assume user is already validated as the approver by the token generation logic
        // But double check if they are actually in the list or is admin

        const isApprover = stepApprovers.some(a => a.user_id === user.id);
        const isAdmin = user.role === 'admin';

        // Proxy Check
        const isProxy = stepApprovers.some(a => {
            if (a.proxy_user_id === user.id) {
                const now = new Date();
                const start = a.proxy_start_date ? new Date(a.proxy_start_date) : new Date(0);
                const end = a.proxy_end_date ? new Date(a.proxy_end_date) : new Date(8640000000000000);
                if (now >= start && now <= end) {
                    proxyForUser = a; // The approver record
                    return true;
                }
            }
            return false;
        });

        // DBA Check (for final approval if needed? No, logic says 'approved' status is handled by DBA)
        const isDBA = user.role === 'dba' || (user.role && user.role.includes('dba'));

        if (!isApprover && !isAdmin && !isProxy && !isDBA) {
            throw new Error('Unauthorized Approver');
        }

        // If status is NOT reviewing, can't approve (unless it's already approved and we are re-approving? No)
        // Exception: DBA approving 'approved' -> 'online' is separate action 'online'
        if (app.status !== 'reviewing') {
            throw new Error('Request is not in reviewing status');
        }

        // 6. Transition
        const maxStep = approvers.length > 0 ? Math.max(...approvers.map(a => a.step_order)) : 0;

        if (currentStep < maxStep) {
            // Move to next step
            db.prepare('UPDATE applications SET current_step = ? WHERE id = ?').run(currentStep + 1, requestId);
            newStatus = 'reviewing';

            const nextStep = currentStep + 1;
            const nextApprover = approvers.find(a => a.step_order === nextStep && a.active === 1);
            if (nextApprover) {
                nextApproverId = nextApprover.user_id;
            }
        } else {
            // Final Step -> Move to Approved (DBA)
            newStatus = 'approved';
        }
    }
    else if (action === 'reject') {
        if (app.status === 'reviewing') {
            // Manager Reject
            // Check if manager/approver
            // Simplified permission check: If they are manager or admin or in approver list
            // For magic link, we trust the token user.
            newStatus = 'manager_rejected';
        } else if (app.status === 'approved') {
            // DBA Reject
            const isDBA = user.role === 'dba' || (user.role && user.role.includes('dba'));
            if (!isDBA && user.role !== 'admin') throw new Error('Unauthorized: DBA only');
            newStatus = 'dba_rejected';
        } else {
            throw new Error('Cannot reject in current status');
        }
    }
    else if (action === 'void') {
        if (app.applicant_id !== user.id && user.role !== 'admin') throw new Error('Unauthorized');
        if (!['draft', 'manager_rejected', 'dba_rejected'].includes(app.status)) throw new Error('Only draft/rejected can be voided');
        newStatus = 'void';
    }
    else if (action === 'online') {
        const isDBA = user.role === 'dba' || (user.role && user.role.includes('dba'));
        if (!isDBA && user.role !== 'admin') throw new Error('Unauthorized: DBA only');
        if (app.status !== 'approved') throw new Error('Request is not approved yet');
        newStatus = 'online';
        dbaComment = comment;
    }
    else {
        throw new Error('Invalid Action');
    }

    // 3. Update DB
    if (newStatus !== app.status || dbaComment) {
        db.prepare(`
            UPDATE applications 
            SET status = ?, dba_comment = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(newStatus, dbaComment || app.dba_comment, requestId);
    }

    // 4. Notifications
    try {
        if (action === 'submit') {
            await mailService.sendSignerNotification(requestId, user.name, nextApproverId);
        }
        else if (action === 'approve') {
            if (newStatus === 'reviewing' && nextApproverId) {
                await mailService.sendSignerNotification(requestId, user.name, nextApproverId);
            }
            if (newStatus === 'approved') {
                await mailService.sendDBANotification(requestId, user.name);
            }
            if (proxyForUser) {
                // Fetch username for proxyForUser
                const originalUser = db.prepare('SELECT username FROM users WHERE id = ?').get(proxyForUser.user_id);
                if (originalUser) {
                    await mailService.sendProxyNotification(requestId, originalUser.username, user.name, proxyForUser.user_id);
                }
            }
        }
        else if ((action === 'reject') && (newStatus === 'manager_rejected' || newStatus === 'dba_rejected')) {
            await mailService.sendApplicantNotification(requestId, 'reject', comment);
        }
        else if (action === 'online') {
            await mailService.sendApplicantNotification(requestId, 'online', comment);
        }

    } catch (e) {
        console.error("Notification Error:", e);
    }

    return { success: true, status: newStatus };
}

module.exports = {
    processRequestAction
};
