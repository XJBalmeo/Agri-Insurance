const express = require('express');
const cors = require('cors');
const db = require('./db');
const { sanitizeApplicationData, validateApplicationData, isValidStatus, VALID_STATUSES } = require('./validators');
const { verifyPassword, createSession, requireAuth } = require('./auth');
// .env (DB credentials + ADMIN_PASSWORD) is loaded by ./db via dotenv.

// Refuse to start without an admin password — otherwise the admin API
// would silently run wide open.
if (!process.env.ADMIN_PASSWORD) {
    console.error('FATAL: ADMIN_PASSWORD is not set in pcic-backend/.env — refusing to start.');
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ======================================================
// HELPER FUNCTION: GENERATE SEQUENTIAL IDs
// ======================================================
async function generateNextId(connection, tableName, idColumn, prefix, padding) {
    // 1. Ask MySQL for the highest ID currently in the table
    const [rows] = await connection.query(`
        SELECT ${idColumn} FROM ${tableName} 
        WHERE ${idColumn} LIKE ? 
        ORDER BY LENGTH(${idColumn}) DESC, ${idColumn} DESC 
        LIMIT 1
    `, [`${prefix}%`]);

    // 2. If the table is empty, return the very first ID (e.g., 'P001')
    if (rows.length === 0) {
        return prefix + String(1).padStart(padding, '0');
    }

    // 3. Extract the number, add 1, and format it
    const currentMaxId = rows[0][idColumn]; // e.g., "P03"
    const numberPart = parseInt(currentMaxId.replace(prefix, ''), 10); // Turns "03" into 3
    const nextNumber = numberPart + 1; // 3 + 1 = 4

    return prefix + String(nextNumber).padStart(padding, '0'); // Returns "P004"
}

// True when the error means "MySQL is unreachable" (stopped, refusing
// connections, or timing out) rather than "this particular query failed".
// Unreachable gets a 503 (Service Unavailable) so the frontend can show
// its maintenance notice instead of a generic failure.
function isDbUnavailable(error) {
    return ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(error.code);
}


// ======================================================
// 🚀 THE MAIN SUBMISSION ROUTE
// ======================================================
app.post('/api/submit-insurance', async (req, res) => {
    // Declared outside try so catch/finally can roll back and release it,
    // but only assigned inside try — if the pool itself is down, the error
    // lands in our catch instead of escaping as an unhandled HTML 500.
    let connection;

    try {
        const data = req.body;

        // PHASE 3: Trim whitespace first, then reject bad data before any DB work.
        sanitizeApplicationData(data);
        const validationErrors = validateApplicationData(data);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        // Only borrow a pool connection once the payload is worth saving.
        connection = await db.getConnection();
        await connection.beginTransaction();

        // ==========================================
        // 1. CHECK FOR EXISTING PROPOSER OR CREATE NEW
        // ==========================================
        let proposerId;
        const [existingProposer] = await connection.execute(
            `SELECT ProposerID FROM ProposerTable WHERE ProposerName = ? AND Birthday = ? LIMIT 1`,
            [data.proposerName, data.birthday]
        );

        if (existingProposer.length > 0) {
            proposerId = existingProposer[0].ProposerID;

            // Check for Active Policies. Rejected applications don't count:
            // a farmer the admin turned down may re-apply immediately.
            const [activePolicies] = await connection.execute(
                `SELECT InsuranceID, CoverageEnd FROM InsuranceTable
                 WHERE ProposerID = ? AND CoverageEnd >= CURDATE()
                   AND ApplicationStatus <> 'Rejected' LIMIT 1`,
                [proposerId]
            );

            // If an active policy is found, abort
            if (activePolicies.length > 0) {
                await connection.rollback();
                const endDate = new Date(activePolicies[0].CoverageEnd).toLocaleDateString();
                return res.status(400).json({
                    error: `Application rejected. This farmer already has an active policy (${activePolicies[0].InsuranceID}) that does not expire until ${endDate}.`
                });
            }

            // Update their old profile with their newest details (name and
            // birthday stay untouched — they ARE the identity key).
            await connection.execute(`
                UPDATE ProposerTable
                SET Address = ?, ContactNo = ?, SecondaryContactNo = ?, CivilStatus = ?, Sex = ?, IP = ?, Tribe = ?, Spouse = ?, SpouseBirthday = ?
                WHERE ProposerID = ?
            `, [
                data.address, data.contactNo, data.secondaryContactNo || null,
                data.civilStatus, data.sex, data.isIP ? 1 : 0, data.tribe || null,
                data.spouse || null, data.spouseBirthday || null,
                proposerId
            ]);

        } else {
            // New Proposer! Generate ID and insert
            proposerId = await generateNextId(connection, 'ProposerTable', 'ProposerID', 'P', 3);

            await connection.execute(`
                INSERT INTO ProposerTable
                (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                proposerId, data.proposerName, data.address, data.birthday,
                data.contactNo, data.secondaryContactNo || null, data.civilStatus,
                data.sex, data.isIP ? 1 : 0, data.tribe || null,
                data.spouse || null, data.spouseBirthday || null
            ]);
        }

        // ==========================================
        // 2. CHECK FOR EXISTING FARM OR CREATE NEW
        // ==========================================
        let plantationId;
        const [existingFarm] = await connection.execute(
            `SELECT PlantationID FROM FarmTable WHERE PlantationName = ? AND FarmAddress = ? LIMIT 1`,
            [data.plantationName, data.farmAddress]
        );

        if (existingFarm.length > 0) {
            plantationId = existingFarm[0].PlantationID;

            // If Farm already exists, Update to the latest area size, soil type, irrigation, etc.
            await connection.execute(`
                UPDATE FarmTable 
                SET FarmArea = ?, SoilType = ?, SoilPH = ?, Topography = ?, IrrigationType = ?
                WHERE PlantationID = ?
            `, [
                data.farmArea, data.soilType, data.soilPH, data.topography, data.irrigationType,
                plantationId
            ]);

        } else {
            // else Generate ID and insert
            plantationId = await generateNextId(connection, 'FarmTable', 'PlantationID', 'F', 3);
            
            await connection.execute(`
                INSERT INTO FarmTable 
                (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                plantationId, data.plantationName, data.farmAddress, data.farmArea, 
                data.soilType, data.soilPH, data.topography, data.irrigationType
            ]);
        }

        // ==========================================
        // 3. ALWAYS CREATE A NEW INSURANCE RECORD
        // ==========================================
        const insuranceId = await generateNextId(connection, 'InsuranceTable', 'InsuranceID', 'INS', 3);
        
        await connection.execute(`
            INSERT INTO InsuranceTable 
            (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            insuranceId, proposerId, data.beneficiary, data.crops, data.plantationSize, 
            data.coverageStart, data.coverageEnd, 
            data.perils.flood ? 1 : 0, data.perils.typhoon ? 1 : 0, 
            data.perils.drought ? 1 : 0, data.perils.pests ? 1 : 0, 
            data.desiredAmountCover, plantationId, 
            data.supervisingPT, data.ptDate, data.proposerDate || null
        ]);

        // ==========================================
        // 4. VARIETY TABLE
        // ==========================================
        if (data.varieties && data.varieties.length > 0) {
            for (let v of data.varieties) {
                await connection.execute(`
                    INSERT INTO VarietyTable 
                    (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    insuranceId, v.varietyName, v.areaPlanted, v.datePlanting, 
                    v.estHarvestDate, v.ageGroup || null, v.numTrees || 0, v.avgYield || 0
                ]);
            }
        }

        // ==========================================
        // 5. CPI SCHEDULE, MATERIALS, AND LABOR
        // ==========================================
        if (data.cpiSchedule && data.cpiSchedule.length > 0) {
            for (let day of data.cpiSchedule) {
                
                // 1. Insert the schedule and let MySQL auto-generate the CPIID
                const [cpiResult] = await connection.execute(`
                    INSERT INTO CPITable (InsuranceID, DaysNoAfterPlanting) 
                    VALUES (?, ?)
                `, [insuranceId, day.daysAfterPlanting]);

                // 2. Catch the newly generated ID!
                const generatedCpiId = cpiResult.insertId;

                // 3. Save Materials using ONLY the generatedCpiId
                if (day.materials && day.materials.length > 0) {
                    for (let mat of day.materials) {
                        await connection.execute(`
                            INSERT INTO CPIMaterialTable 
                            (CPIID, MaterialItem, MaterialQuantity, MaterialCost) 
                            VALUES (?, ?, ?, ?)
                        `, [generatedCpiId, mat.item, mat.quantity, mat.cost]);
                    }
                }

                // 4. Save Labor using ONLY the generatedCpiId
                if (day.labor && day.labor.length > 0) {
                    for (let lab of day.labor) {
                        await connection.execute(`
                            INSERT INTO CPILaborTable 
                            (CPIID, LaborWorkforce, LaborQuantity, LaborCost) 
                            VALUES (?, ?, ?, ?)
                        `, [generatedCpiId, lab.workforce, lab.quantity, lab.cost]);
                    }
                }
            }
        }

        await connection.commit();
        res.status(200).json({ 
            message: 'Insurance application successfully saved!',
            generatedInsuranceID: insuranceId,
            generatedProposerID: proposerId,
            generatedPlantationID: plantationId
        });

    } catch (error) {
        // Roll back only if we got far enough to hold a connection — and the
        // rollback itself can throw if that connection has already died.
        if (connection) {
            try { await connection.rollback(); } catch (_) { /* connection gone */ }
        }
        console.error("Transaction Failed:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ error: 'Database temporarily unavailable. Please try again later.' });
        }
        // No error.message here — SQL internals stay in the server log.
        res.status(500).json({ error: 'Failed to save application.' });
    } finally {
        if (connection) connection.release();
    }
});

// ======================================================
// ROUTE: Get the Total Cost of an Insurance Policy
// ======================================================
app.get('/api/insurance/:id/cost', requireAuth, async (req, res) => {
    const insuranceId = req.params.id;

    try {
        // We use JOINs now because the cost tables only know the CPIID, not the InsuranceID
        const [materialResult] = await db.query(`
            SELECT SUM(m.MaterialCost) AS TotalMaterialCost 
            FROM CPIMaterialTable m
            JOIN CPITable c ON m.CPIID = c.CPIID
            WHERE c.InsuranceID = ?
        `, [insuranceId]);

        const [laborResult] = await db.query(`
            SELECT SUM(l.LaborCost) AS TotalLaborCost 
            FROM CPILaborTable l
            JOIN CPITable c ON l.CPIID = c.CPIID
            WHERE c.InsuranceID = ?
        `, [insuranceId]);

        const matCost = Number(materialResult[0].TotalMaterialCost) || 0;
        const labCost = Number(laborResult[0].TotalLaborCost) || 0;
        const grandTotal = matCost + labCost;

        res.status(200).json({
            InsuranceID: insuranceId,
            TotalMaterialCost: matCost,
            TotalLaborCost: labCost,
            GrandTotal: grandTotal
        });

    } catch (error) {
        console.error("Failed to calculate cost:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ error: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ error: 'Failed to calculate total cost.' });
    }
});

// ======================================================
// ACTIVE-POLICY CHECK BY NAME + BIRTHDAY (public)
// ======================================================
// Lets the form warn a returning farmer about an active policy right
// on step 1, instead of failing after they fill in six steps. Uses the
// same name+birthday match and "active" definition as the submit
// route. Deliberately returns NO profile data — just the policy ID and
// end date — so the public endpoint exposes nothing personal.
app.post('/api/proposer/active-policy', async (req, res) => {
    const proposerName = typeof req.body?.proposerName === 'string' ? req.body.proposerName.trim() : '';
    const birthday = typeof req.body?.birthday === 'string' ? req.body.birthday.trim() : '';

    if (proposerName === '' || !Number.isFinite(Date.parse(birthday))) {
        return res.status(400).json({
            error: 'Validation failed',
            details: ['Proposer name and a valid birthday are required.'],
        });
    }

    try {
        // Active = coverage not yet ended and not Rejected (turned-down
        // farmers may re-apply). DATE_FORMAT returns a plain 'YYYY-MM-DD'
        // string — without it, mysql2 serializes DATE columns as UTC
        // timestamps that read as the previous day at UTC+8.
        const [rows] = await db.query(`
            SELECT i.InsuranceID, DATE_FORMAT(i.CoverageEnd, '%Y-%m-%d') AS CoverageEnd
            FROM InsuranceTable i
            JOIN ProposerTable p ON i.ProposerID = p.ProposerID
            WHERE p.ProposerName = ? AND p.Birthday = ?
              AND i.CoverageEnd >= CURDATE()
              AND i.ApplicationStatus <> 'Rejected'
            LIMIT 1
        `, [proposerName, birthday]);

        res.json({
            activePolicy: rows.length > 0
                ? { insuranceId: rows[0].InsuranceID, coverageEnd: rows[0].CoverageEnd }
                : null,
        });
    } catch (error) {
        console.error('Active-Policy Check Error:', error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: 'Database error' });
    }
});

// ======================================================
// ADMIN LOGIN
// ======================================================
// Exchanges the admin password for a session token. The token (not the
// password) is what the browser sends on every later request, so the
// password crosses the wire exactly once per login.
app.post('/api/login', (req, res) => {
    if (!verifyPassword(req.body?.password)) {
        return res.status(401).json({ message: 'Incorrect password' });
    }
    res.json({ token: createSession() });
});

// ======================================================
// FETCH DATA FOR ADMIN DASHBOARD
// ======================================================
app.get('/api/tables/:tableName', requireAuth, async (req, res) => {
    const { tableName } = req.params;
    const tableMap = {
        'cpilabor': 'CPILaborTable',
        'cpimaterial': 'CPIMaterialTable',
        'cpi': 'CPITable',
        'farm': 'FarmTable',
        'insurance': 'InsuranceTable',
        'proposer': 'ProposerTable',
        'variety': 'VarietyTable'
    };

    const targetTable = tableMap[tableName];
    if (!targetTable) return res.status(400).send("Table mapping missing");

    try {
        const [rows] = await db.query(`SELECT * FROM ${targetTable}`);
        console.log(`Successfully fetched ${rows.length} rows from ${targetTable}`);
        res.json(rows);
    } catch (error) {
        console.error("Fetch Error:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ error: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ error: 'Failed to fetch table data.' });
    }
});

// ======================================================
// 🗑️ DELETE ROUTE: HANDLE ALL TABLES
// ======================================================
app.delete('/api/tables/:tableName/:id', requireAuth, async (req, res) => {
    const { tableName } = req.params;
    const idValue = req.params.id;

    const tableMap = {
        'cpilabor': 'CPILaborTable',
        'cpimaterial': 'CPIMaterialTable',
        'cpi': 'CPITable',
        'farm': 'FarmTable',
        'insurance': 'InsuranceTable',
        'proposer': 'ProposerTable'
        // VarietyTable has no per-row key, so single-variety delete isn't
        // offered here; varieties are removed when their policy is deleted.
    };

    const targetTable = tableMap[tableName];
    if (!targetTable) return res.status(400).json({ message: "Table not found" });

    let idColumn;
    switch (tableName) {
        case 'cpi':
            idColumn = 'CPIID';
            break;
        case 'cpilabor':
            idColumn = 'LaborID';
            break;
        case 'cpimaterial':
            idColumn = 'MaterialID';
            break;
        case 'insurance':
            idColumn = 'InsuranceID';
            break;
        case 'farm':
            idColumn = 'PlantationID';
            break;
        case 'proposer':
            idColumn = 'ProposerID';
            break;
        default:
            idColumn = 'ID';
    }

    try {
        const sql = `DELETE FROM ${targetTable} WHERE ${idColumn} = ?`;
        const [result] = await db.execute(sql, [idValue]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Record not found" });
        }

        res.json({ message: `Successfully deleted from ${targetTable}` });
    } catch (error) {
        console.error("Delete Error:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: "Database error" });
    }
});

// ======================================================
// 🗑️ CASCADE DELETE: ONE CPI BLOCK + ITS MATERIALS/LABOR
// Wrapped in a transaction so children and parent vanish together.
// ======================================================
app.delete('/api/cpi/:id', requireAuth, async (req, res) => {
    const cpiId = req.params.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Children first — the foreign keys forbid deleting the CPI row
        // while materials/labor still reference its CPIID.
        await connection.execute(`DELETE FROM CPILaborTable WHERE CPIID = ?`, [cpiId]);
        await connection.execute(`DELETE FROM CPIMaterialTable WHERE CPIID = ?`, [cpiId]);

        const [result] = await connection.execute(`DELETE FROM CPITable WHERE CPIID = ?`, [cpiId]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "CPI record not found" });
        }

        await connection.commit();
        res.json({ message: `Successfully deleted CPI ${cpiId} and its materials/labor.` });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) { /* connection gone */ }
        }
        console.error("CPI Cascade Delete Error:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: "Database error" });
    } finally {
        if (connection) connection.release();
    }
});

// ======================================================
// 🗑️ CASCADE DELETE: A WHOLE INSURANCE POLICY
// Removes every dependent row (CPI labor/materials, CPI blocks, varieties)
// and the policy itself in a single transaction. Replaces the old admin-side
// cascade that fired a dozen un-transacted requests from the browser.
// ======================================================
app.delete('/api/insurance/:id', requireAuth, async (req, res) => {
    const insuranceId = req.params.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Grandchildren: labor + materials, reached via their CPI parent.
        await connection.execute(`
            DELETE l FROM CPILaborTable l
            JOIN CPITable c ON l.CPIID = c.CPIID
            WHERE c.InsuranceID = ?
        `, [insuranceId]);
        await connection.execute(`
            DELETE m FROM CPIMaterialTable m
            JOIN CPITable c ON m.CPIID = c.CPIID
            WHERE c.InsuranceID = ?
        `, [insuranceId]);

        // Children: CPI blocks and varieties.
        await connection.execute(`DELETE FROM CPITable WHERE InsuranceID = ?`, [insuranceId]);
        await connection.execute(`DELETE FROM VarietyTable WHERE InsuranceID = ?`, [insuranceId]);

        // Finally the policy itself.
        const [result] = await connection.execute(
            `DELETE FROM InsuranceTable WHERE InsuranceID = ?`, [insuranceId]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Insurance record not found" });
        }

        await connection.commit();
        res.json({ message: `Successfully deleted ${insuranceId} and all related records.` });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) { /* connection gone */ }
        }
        console.error("Insurance Cascade Delete Error:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: "Database error" });
    } finally {
        if (connection) connection.release();
    }
});

// ======================================================
// 🗑️ CASCADE DELETE: A PROPOSER (and everything beneath them)
// A proposer can hold several policies; each policy drags along its
// varieties + CPI blocks + CPI labor/materials. We delete from the
// bottom of the tree up so no foreign key is ever left dangling, all
// inside one transaction so a failure halfway through rolls back.
// ======================================================
app.delete('/api/proposer/:id', requireAuth, async (req, res) => {
    const proposerId = req.params.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Great-grandchildren: labor + materials, reached via CPI -> Insurance.
        await connection.execute(`
            DELETE l FROM CPILaborTable l
            JOIN CPITable c ON l.CPIID = c.CPIID
            JOIN InsuranceTable i ON c.InsuranceID = i.InsuranceID
            WHERE i.ProposerID = ?
        `, [proposerId]);
        await connection.execute(`
            DELETE m FROM CPIMaterialTable m
            JOIN CPITable c ON m.CPIID = c.CPIID
            JOIN InsuranceTable i ON c.InsuranceID = i.InsuranceID
            WHERE i.ProposerID = ?
        `, [proposerId]);

        // Grandchildren: CPI blocks and varieties of every policy.
        await connection.execute(`
            DELETE c FROM CPITable c
            JOIN InsuranceTable i ON c.InsuranceID = i.InsuranceID
            WHERE i.ProposerID = ?
        `, [proposerId]);
        await connection.execute(`
            DELETE v FROM VarietyTable v
            JOIN InsuranceTable i ON v.InsuranceID = i.InsuranceID
            WHERE i.ProposerID = ?
        `, [proposerId]);

        // Children: the policies themselves.
        await connection.execute(`DELETE FROM InsuranceTable WHERE ProposerID = ?`, [proposerId]);

        // Finally the proposer. affectedRows here tells us whether the ID existed.
        const [result] = await connection.execute(
            `DELETE FROM ProposerTable WHERE ProposerID = ?`, [proposerId]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Proposer not found" });
        }

        await connection.commit();
        res.json({ message: `Successfully deleted ${proposerId} and all related records.` });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) { /* connection gone */ }
        }
        console.error("Proposer Cascade Delete Error:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: "Database error" });
    } finally {
        if (connection) connection.release();
    }
});

// ======================================================
// 🗑️ CASCADE DELETE: A FARM (plantation) and everything beneath it
// Same shape as the proposer cascade, but the policies are linked by
// PlantationID instead of ProposerID.
// ======================================================
app.delete('/api/farm/:id', requireAuth, async (req, res) => {
    const plantationId = req.params.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.execute(`
            DELETE l FROM CPILaborTable l
            JOIN CPITable c ON l.CPIID = c.CPIID
            JOIN InsuranceTable i ON c.InsuranceID = i.InsuranceID
            WHERE i.PlantationID = ?
        `, [plantationId]);
        await connection.execute(`
            DELETE m FROM CPIMaterialTable m
            JOIN CPITable c ON m.CPIID = c.CPIID
            JOIN InsuranceTable i ON c.InsuranceID = i.InsuranceID
            WHERE i.PlantationID = ?
        `, [plantationId]);

        await connection.execute(`
            DELETE c FROM CPITable c
            JOIN InsuranceTable i ON c.InsuranceID = i.InsuranceID
            WHERE i.PlantationID = ?
        `, [plantationId]);
        await connection.execute(`
            DELETE v FROM VarietyTable v
            JOIN InsuranceTable i ON v.InsuranceID = i.InsuranceID
            WHERE i.PlantationID = ?
        `, [plantationId]);

        await connection.execute(`DELETE FROM InsuranceTable WHERE PlantationID = ?`, [plantationId]);

        const [result] = await connection.execute(
            `DELETE FROM FarmTable WHERE PlantationID = ?`, [plantationId]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Farm not found" });
        }

        await connection.commit();
        res.json({ message: `Successfully deleted ${plantationId} and all related records.` });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) { /* connection gone */ }
        }
        console.error("Farm Cascade Delete Error:", error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: "Database error" });
    } finally {
        if (connection) connection.release();
    }
});

// ======================================================
// UPDATE APPLICATION STATUS (admin)
// ======================================================
// A single-row UPDATE needs no transaction — transactions exist to keep
// *multiple* statements consistent (like the cascade deletes above);
// one statement is already atomic on its own.
app.patch('/api/insurance/:id/status', requireAuth, async (req, res) => {
    const insuranceId = req.params.id;
    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : req.body?.status;

    if (!isValidStatus(status)) {
        return res.status(400).json({
            error: 'Validation failed',
            details: [`Status must be one of: ${VALID_STATUSES.join(', ')}.`],
        });
    }

    try {
        const [result] = await db.query(
            `UPDATE InsuranceTable SET ApplicationStatus = ? WHERE InsuranceID = ?`,
            [status, insuranceId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Insurance record not found' });
        }
        res.json({ message: `${insuranceId} is now ${status}.` });
    } catch (error) {
        console.error('Status Update Error:', error);
        if (isDbUnavailable(error)) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again later.' });
        }
        res.status(500).json({ message: 'Database error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});