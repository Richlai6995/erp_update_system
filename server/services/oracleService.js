const oracledb = require('oracledb');
require('dotenv').config();

// Use Thin Mode (no Instant Client required if DB is recent enough)
// Use Thin Mode (no Instant Client required if DB is recent enough)
try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_HOME || '/opt/oracle/instantclient_19_26' });
} catch (e) {
    console.log("Oracle Client Init Error:", e.message);
}

const config = {
    user: process.env.ERP_DB_USER,
    password: process.env.ERP_DB_USER_PASSWORD,
    connectString: `${process.env.ERP_DB_HOST}:${process.env.ERP_DB_PORT}/${process.env.ERP_DB_SERVICE_NAME}`
};

async function getDDL(schemaName, objectName, objectType) {
    let connection;
    try {
        console.log(`[Oracle] Connecting to ${config.connectString} as ${config.user}...`);
        connection = await oracledb.getConnection(config);

        // Ensure objectType is valid for DBMS_METADATA
        // Common types: TABLE, VIEW, PACKAGE, PACKAGE_BODY, PROCEDURE, FUNCTION, TRIGGER, INDEX
        // Input `objectType` might be from our UI "DB Object Type" list.
        // We might need to map it or trust the user input (but validate/sanitize).

        // Use DBMS_METADATA.GET_DDL
        // Function signature: GET_DDL (object_type IN VARCHAR2, name IN VARCHAR2, schema IN VARCHAR2 DEFAULT NULL, version IN VARCHAR2 DEFAULT 'COMPATIBLE', model IN VARCHAR2 DEFAULT 'ORACLE', transform IN VARCHAR2 DEFAULT 'DDL') RETURN CLOB

        const sql = `SELECT DBMS_METADATA.GET_DDL(:type, :name, :schema) as DDL FROM DUAL`;

        const result = await connection.execute(sql, {
            type: objectType.toUpperCase().replace(' ', '_'), // e.g., 'PACKAGE BODY' -> 'PACKAGE_BODY'
            name: objectName.toUpperCase(),
            schema: schemaName.toUpperCase()
        }, {
            fetchInfo: { DDL: { type: oracledb.STRING } } // Fetch CLOB as String
        });

        if (result.rows && result.rows.length > 0) {
            return result.rows[0][0]; // The DDL string
        } else {
            throw new Error(`Object not found: ${schemaName}.${objectName} (${objectType})`);
        }

    } catch (err) {
        console.error('[Oracle] GetDDL Error:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('[Oracle] Close Connection Error:', err);
            }
        }
    }
}

async function testConnection() {
    let connection;
    try {
        connection = await oracledb.getConnection(config);
        const result = await connection.execute('SELECT 1 FROM DUAL');
        console.log('[Oracle] Connection Test Successful:', result.rows);
        return true;
    } catch (err) {
        console.error('[Oracle] Connection Test Failed:', err);
        return false;
    } finally {
        if (connection) await connection.close();
    }
}

module.exports = {
    getDDL,
    testConnection
};
