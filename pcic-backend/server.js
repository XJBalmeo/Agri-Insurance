const express = require('express');
const cors = require('cors');
const db = require('./db'); 
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); 

// 🚀 THE MAIN SUBMISSION ROUTE
app.post('/api/submit-insurance', async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        // Start the "All or Nothing" lock
        await connection.beginTransaction();

        const data = req.body; 

        // Generate unique IDs for this specific application
        const proposerId = 'P' + Date.now().toString().slice(-6); 
        const plantationId = 'F' + Date.now().toString().slice(-6);
        const insuranceId = 'INS' + Date.now().toString().slice(-5);

        // ======================================================
        // 1. PROPOSER TABLE
        // ======================================================
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

        // ======================================================
        // 2. FARM TABLE
        // ======================================================
        await connection.execute(`
            INSERT INTO FarmTable 
            (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            plantationId, data.plantationName, data.farmAddress, data.farmArea, 
            data.soilType, data.soilPH, data.topography, data.irrigationType
        ]);

        // ======================================================
        // 3. INSURANCE TABLE (Links to Proposer and Farm)
        // ======================================================
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

        // ======================================================
        // 4. VARIETY TABLE
        // ======================================================
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

        // ======================================================
        // 5, 6, & 7. CPI SCHEDULE, MATERIALS, AND LABOR
        // ======================================================
        if (data.cpiSchedule && data.cpiSchedule.length > 0) {
            for (let day of data.cpiSchedule) {
                
                // A. Insert the Base CPI Day
                await connection.execute(`
                    INSERT INTO CPITable (InsuranceID, DaysNoAfterPlanting) 
                    VALUES (?, ?)
                `, [insuranceId, day.daysAfterPlanting]);

                // B. Insert all Materials for this Day
                if (day.materials && day.materials.length > 0) {
                    for (let mat of day.materials) {
                        await connection.execute(`
                            INSERT INTO CPIMaterialTable 
                            (InsuranceID, DaysNoAfterPlanting, MaterialItem, MaterialQuantity, MaterialCost) 
                            VALUES (?, ?, ?, ?, ?)
                        `, [insuranceId, day.daysAfterPlanting, mat.item, mat.quantity, mat.cost]);
                    }
                }

                // C. Insert all Labor for this Day
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

        // IF NO ERRORS HAPPENED: Commit everything permanently!
        await connection.commit();
        res.status(200).json({ 
            message: 'Insurance application successfully saved!',
            generatedInsuranceID: insuranceId 
        });

    } catch (error) {
        // IF ANYTHING FAILED: Rollback and delete the incomplete data!
        await connection.rollback();
        console.error("Transaction Failed:", error);
        res.status(500).json({ error: 'Failed to save application.', details: error.message });
    } finally {
        connection.release(); // Always return the connection to the pool
    }
});

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});