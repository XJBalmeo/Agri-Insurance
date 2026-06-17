const mysql = require('mysql2/promise');
const path = require('path');
// Load the .env that sits next to this file, regardless of which
// directory `node` was launched from (dotenv defaults to process.cwd()).
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // Return DATE/DATETIME columns as literal 'YYYY-MM-DD' strings instead of
    // JS Date objects. Without this, mysql2 builds a Date in the server's local
    // timezone, and JSON.stringify then serializes it to UTC — shifting pure
    // calendar dates (Birthday, CoverageStart, etc.) back a day in UTC+8.
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Fail fast when MySQL is unreachable (default is 10s) so the API can
    // answer with a clean 503 before the frontend's 10s request timeout fires.
    connectTimeout: 5000
});

module.exports = pool;