const express = require('express');
const cors = require('cors');
const db = require('./db');
const { sanitizeApplicationData, validateApplicationData } = require('./validators');
require('dotenv').config();

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


// ======================================================
// 🚀 THE MAIN SUBMISSION ROUTE
// ======================================================
app.post('/api/submit-insurance', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const data = req.body;

        // PHASE 3: Trim whitespace first, then reject bad data before any DB work.
        sanitizeApplicationData(data);
        const validationErrors = validateApplicationData(data);
        if (validationErrors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: validationErrors });
        }

        await connection.beginTransaction();

        // Generate CLEAN, sequential IDs dynamically!
        const proposerId = await generateNextId(connection, 'ProposerTable', 'ProposerID', 'P', 3);
        const plantationId = await generateNextId(connection, 'FarmTable', 'PlantationID', 'F', 3);
        const insuranceId = await generateNextId(connection, 'InsuranceTable', 'InsuranceID', 'INS', 3);

        // 1. PROPOSER TABLE
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

        // 2. FARM TABLE
        await connection.execute(`
            INSERT INTO FarmTable 
            (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            plantationId, data.plantationName, data.farmAddress, data.farmArea, 
            data.soilType, data.soilPH, data.topography, data.irrigationType
        ]);

        // 3. INSURANCE TABLE
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

        // 4. VARIETY TABLE
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

        // 5, 6, & 7. CPI SCHEDULE, MATERIALS, AND LABOR
        if (data.cpiSchedule && data.cpiSchedule.length > 0) {
            for (let day of data.cpiSchedule) {
                
                await connection.execute(`
                    INSERT INTO CPITable (InsuranceID, DaysNoAfterPlanting) 
                    VALUES (?, ?)
                `, [insuranceId, day.daysAfterPlanting]);

                if (day.materials && day.materials.length > 0) {
                    for (let mat of day.materials) {
                        await connection.execute(`
                            INSERT INTO CPIMaterialTable 
                            (InsuranceID, DaysNoAfterPlanting, MaterialItem, MaterialQuantity, MaterialCost) 
                            VALUES (?, ?, ?, ?, ?)
                        `, [insuranceId, day.daysAfterPlanting, mat.item, mat.quantity, mat.cost]);
                    }
                }

                if (day.labor && day.labor.length > 0) {
                    for (let lab of day.labor) {
                        await connection.execute(`
                            INSERT INTO CPILaborTable 
                            (InsuranceID, DaysNoAfterPlanting, LaborWorkforce, LaborQuantity, LaborCost) 
                            VALUES (?, ?, ?, ?, ?)
                        `, [insuranceId, day.daysAfterPlanting, lab.workforce, lab.quantity, lab.cost]);
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
        await connection.rollback();
        console.error("Transaction Failed:", error);
        res.status(500).json({ error: 'Failed to save application.', details: error.message });
    } finally {
        connection.release(); 
    }
});

// ======================================================
// 🔍 ROUTE: Get the Total Cost of an Insurance Policy
// ======================================================
app.get('/api/insurance/:id/cost', async (req, res) => {
    const insuranceId = req.params.id;

    try {
        const [materialResult] = await db.query(`SELECT SUM(MaterialCost) AS TotalMaterialCost FROM CPIMaterialTable WHERE InsuranceID = ?`, [insuranceId]);
        const [laborResult] = await db.query(`SELECT SUM(LaborCost) AS TotalLaborCost FROM CPILaborTable WHERE InsuranceID = ?`, [insuranceId]);

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
        res.status(500).json({ error: 'Failed to calculate total cost.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});