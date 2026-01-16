const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function run() {
    try {
        const SQL = await initSqlJs();
        const dbPath = path.join(__dirname, 'system.db');
        const buffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(buffer);

        console.log('--- Tracing Permissions ---');

        // 1. Get Jenny
        const jennyRes = db.exec("SELECT id, name, username, department FROM users WHERE username LIKE '%JENNY%'");
        if (!jennyRes.length) return console.log("Jenny not found");
        const jenny = jennyRes[0].values[0];
        const jennyId = jenny[0];
        console.log(`Approver: ${jenny[1]} (${jenny[2]}), ID=${jennyId}, Dept=${jenny[3]}`);

        // 2. Check Requests
        const formIds = ['FL202601160039', 'FL202601160040'];
        formIds.forEach(fid => {
            console.log(`\nChecking Request: ${fid}`);
            const appRes = db.exec(`
                SELECT a.id, a.form_id, a.applicant_id, u.name, u.department, a.status, a.current_step
                FROM applications a
                JOIN users u ON a.applicant_id = u.id
                WHERE a.form_id = '${fid}'
            `);

            if (!appRes.length) {
                console.log("  Request not found.");
                return;
            }

            const app = appRes[0].values[0];
            const appId = app[0];
            const applicantId = app[2];
            const applicantName = app[3];
            const applicantDept = app[4];
            const status = app[5];
            const currentStep = app[6] || 1;

            console.log(`  Applicant: ${applicantName} (ID=${applicantId})`);
            console.log(`  App Dept: '${applicantDept}'`);
            console.log(`  Status: ${status}, Step: ${currentStep}`);

            // 3. Check Approvers for this Dept/Step
            const approversRes = db.exec(`
                SELECT da.user_id, u.name, da.step_order 
                FROM department_approvers da
                JOIN departments d ON da.department_id = d.id
                JOIN users u ON da.user_id = u.id
                WHERE d.name = '${applicantDept}' AND da.step_order = ${currentStep} AND da.active = 1
            `);

            if (approversRes.length) {
                const approvers = approversRes[0].values.map(r => `${r[1]} (ID=${r[0]})`);
                console.log(`  Expected Approvers for Step ${currentStep}: ${approvers.join(', ')}`);

                if (approversRes[0].values.some(r => r[0] === jennyId)) {
                    console.log("  [MATCH] Jenny IS an approver.");
                } else {
                    console.log("  [FAIL] Jenny is NOT an approver for this step.");
                }
            } else {
                console.log(`  [FAIL] No approvers configured for Dept '${applicantDept}' Step ${currentStep}`);
                // Debug: List all approvers for this dept
                const allApprovers = db.exec(`
                    SELECT da.step_order, u.name 
                    FROM department_approvers da
                    JOIN departments d ON da.department_id = d.id
                    JOIN users u ON da.user_id = u.id
                    WHERE d.name = '${applicantDept}'
                `);
                if (allApprovers.length) {
                    console.log("  Other steps have approvers:");
                    allApprovers[0].values.forEach(r => console.log(`    Step ${r[0]}: ${r[1]}`));
                } else {
                    console.log(`  Dept '${applicantDept}' has NO approvers at all.`);
                    // Check if dept exists
                    const deptRes = db.exec(`SELECT id FROM departments WHERE name = '${applicantDept}'`);
                    if (!deptRes.length) console.log("  Dept name does not match any department in DB.");
                }
            }
        });

    } catch (e) {
        console.error(e);
    }
}

run();
