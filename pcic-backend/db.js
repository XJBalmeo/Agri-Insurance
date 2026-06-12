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
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;