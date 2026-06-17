-- ==============================================================
-- PCIC DATABASE RESET & POPULATION SCRIPT (INS001 TO INS008)
-- ==============================================================
-- Loads 8 sample policies for demos/testing. Assumes the tables already
-- exist (run pcic-backend/schema.sql first if they don't).
--
-- Corrections applied vs. the original draft, to satisfy the schema in
-- pcic-backend/schema.sql (each is marked "-- FIX:" inline):
--   1. P002 CivilStatus was NULL  -> 'M'  (CivilStatus is NOT NULL; he has a spouse)
--   2. P004 CivilStatus was NULL  -> 'S'  (NOT NULL; no spouse listed)
--   3. P005 had CivilStatus='M', Sex='S'  -> 'S','M'  (Sex must be M/F; values were swapped)
--   4. AvgYield is DECIMAL(5,1) (max 9999.9). Three values were out of range:
--        INS002 Cavendish 100000 -> 80.0
--        INS003 Granola   300000 -> 250.0
--        INS003 Igorota   300000 -> 250.0
--   5. Status demo (see UPDATEs at the bottom):
--        INS005 -> Approved   (still blocks a re-application, like Pending)
--        INS008 -> Rejected   (does NOT block re-application, even though coverage is un-ended)
-- ==============================================================

-- 1. TURN OFF SECURITY TO WIPE OLD DATA
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE CPILaborTable;
TRUNCATE TABLE CPIMaterialTable;
TRUNCATE TABLE CPITable;
TRUNCATE TABLE VarietyTable;
TRUNCATE TABLE InsuranceTable;
TRUNCATE TABLE FarmTable;
TRUNCATE TABLE ProposerTable;
SET FOREIGN_KEY_CHECKS = 1;


-- ==========================================
-- RECORD 1: Juan Dela Cruz (INS001)
-- ==========================================
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P001', 'Juan Dela Cruz', 'BLk 123 Macopa St. Brgy 456 Makati City', '2003-12-12', '09987654321', '09123456789', 'M', 'M', 0, NULL, 'Maria Dela Cruz', '2004-02-23');

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F001', 'Old McDonal Farm', 'BLk 264 Macopa St. Brgy Martirez, Cavite', 3, 'Rich Loam', 7.2, 'Gently Sloping', 'Drip Irrigation');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS001', 'P001', 'Mary Joyce Delos Santos', 'Mango', 3, '2025-03-17', '2025-07-17', 1, 1, 1, 1, 300000, 'F001', 'Engr. Joey Martinez', '2025-03-01', '2025-03-01');

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS001', 'Indian Mango', 1.5, '2025-03-17', '2025-06-17', 1.17, 150, 250);

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS001', 'Apple Mango', 1.5, '2025-04-17', '2025-07-17', 1.08, 238, 300);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (1, 'INS001', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (1, 'Fertilizer', 25, 2000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (1, 'Land Tiller', 7, 3500);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (2, 'INS001', 14);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (2, 'Fungicide', 6, 500);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (2, 'Fertilizer Applicator', 4, 2000);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (3, 'INS001', 30);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (3, 'Pesticide', 3, 250);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (3, 'Pesticide Sprayer', 4, 2000);


-- ==========================================
-- RECORD 2: Satoru Gojo Santos (INS002)
-- ==========================================
-- FIX 1: CivilStatus was NULL -> 'M' (married; NOT NULL column)
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P002', 'Satoru Gojo Santos', 'Brgy. Maligaya, Cabanatuan City, Nueva Ecija', '1989-07-12', '09456123093', NULL, 'M', 'M', 1, 'Igorot', 'Shoko Ieiri Santos', '1990-04-01');

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F002', 'JJ Farm', 'Brgy. Maligaya, Cabanatuan City, Nueva Ecija', 2.5, 'Clay Loam', 6.2, 'Level', 'Flood Irrigation');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS002', 'P002', 'Yuji Itadori Santos', 'Banana', 2.5, '2024-06-01', '2024-12-01', 1, 1, 0, 1, 150000, 'F002', 'Engr. Sukuna delos Reyes', '2024-06-03', '2026-06-03');

-- FIX 4: AvgYield 100000 -> 80.0 (DECIMAL(5,1) max is 9999.9)
INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS002', 'Cavendish', 2.5, '2024-06-01', '2024-11-15', 2.00, 1200, 80.0);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (4, 'INS002', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (4, 'Fertilizer', 50, 3500);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (4, 'Land Tiller', 5, 2500);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (5, 'INS002', 14);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (5, 'Fungicide', 10, 800);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (5, 'Fertilizer Applicator', 2, 1000);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (6, 'INS002', 30);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (6, 'Pesticide', 5, 500);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (6, 'Pesticide Sprayer', 1, 300);


-- ==========================================
-- RECORD 3: Jack Garcia (INS003)  [ACTIVE COVERAGE -> triggers warning]
-- ==========================================
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P003', 'Jack Garcia', 'Purok 3, Sitio Malungkot, Brgy. San Isidro, Nueva Ecija', '1990-05-11', '09184203910', NULL, 'S', 'M', 0, NULL, NULL, NULL);

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F003', 'Garcia Farm', 'Sitio Malungkot, Brgy. San Isidro, Nueva Ecija', 2, 'Sandy Loam', 5.5, 'Sloping', 'Sprinkler');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS003', 'P003', 'Nicole Garcia', 'Potato', 2, '2026-01-01', '2027-01-01', 1, 1, 1, 1, 100000, 'F003', 'Engr. Luis Fernandez', '2025-06-29', '2025-06-29');

-- FIX 4: AvgYield 300000 -> 250.0 (DECIMAL(5,1) max is 9999.9)
INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS003', 'Granola', 1, '2026-01-01', '2026-04-01', 0.42, 0, 250.0);

-- FIX 4: AvgYield 300000 -> 250.0
INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS003', 'Igorota', 1, '2026-01-01', '2026-04-01', 0.42, 0, 250.0);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (7, 'INS003', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (7, 'Fertilizer', 30, 3000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (7, 'Land Tiller', 3, 2250);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (8, 'INS003', 14);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (8, 'Pesticide', 5, 350);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (8, 'Pesticide Sprayer', 2, 1500);


-- ==========================================
-- RECORD 4: Rafael Hernandez Ignacio (INS004)
-- ==========================================
-- FIX 2: CivilStatus was NULL -> 'S' (single; NOT NULL column, no spouse listed)
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P004', 'Rafael Hernandez Ignacio', '231-A Ruby St. Brgy 213 Quezon City', '1982-11-04', '09952731842', NULL, 'S', 'M', 0, NULL, NULL, NULL);

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F004', 'Dagupan Hirise Farm', 'BLk 351 Manggahan St. Brgy Dagat, Dagupan City', 10, 'Peaty', 5.8, 'Flat', 'Sprinkler');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS004', 'P004', 'Gil Dela Cruz', 'Corn', 5, '2025-01-23', '2025-06-23', 1, 0, 0, 1, 400000, 'F004', 'Engr. Peter Gonzalez', '2025-01-10', '2025-01-10');

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS004', 'Sweet Corn', 2.5, '2025-02-01', '2025-05-01', 1.5, 100, 300);

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS004', 'Dent Corn', 2.5, '2025-03-15', '2025-06-15', 0.52, 150, 200);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (9, 'INS004', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (9, 'Fertilizer', 30, 3500);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (9, 'Land Tiller', 5, 5000);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (10, 'INS004', 14);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (10, 'Fungicide', 2, 1000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (10, 'Fertilizer Applicator', 5, 6500);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (11, 'INS004', 30);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (11, 'Pesticide', 5, 2500);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (11, 'Pesticide Sprayer', 3, 4000);


-- ==========================================
-- RECORD 5: Kendrick John Baltazar (INS005)  [ACTIVE COVERAGE -> Approved demo]
-- ==========================================
-- FIX 3: was CivilStatus='M', Sex='S' -> 'S','M' (Sex must be M/F; values were swapped)
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P005', 'Kendrick John Baltazar', 'BLk 16 Gumamela St. Brgy 143 Mandaluyong City', '2001-01-05', '09587496587', '09245741256', 'S', 'M', 0, NULL, NULL, NULL);

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F005', 'KJ Farm', 'BLk 31 Venus St. Brgy Lapu-Lapu, Cavite', 3, 'Clay Loam', 6.5, 'Flat', 'Sprinkler');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS005', 'P005', 'Benedict Delos Reyes', 'Banana', 3, '2025-02-16', '2026-09-15', 1, 1, 1, 1, 250000, 'F005', 'Engr. Arturo Briones', '2025-03-01', '2025-03-01');

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS005', 'Lakatan', 1.3, '2025-02-03', '2026-09-06', 1.25, 195, 25);

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS005', 'Saba', 1.7, '2025-02-03', '2026-09-06', 1.25, 200, 45);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (12, 'INS005', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (12, 'Fertilizer', 20, 4000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (12, 'Fertilizer Applicator', 4, 2000);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (13, 'INS005', 14);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (13, 'Fungicide', 10, 2000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (13, 'Land Tiller', 5, 2500);


-- ==========================================
-- RECORD 6: Joselito Manalo (INS006)
-- ==========================================
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P006', 'Joselito Manalo', 'Purok 4, Calmay, Dagupan City', '1992-04-12', '09123456789', NULL, 'S', 'M', 1, 'Mangyan', NULL, NULL);

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F006', 'Mangyan Highlands', 'Brgy. Calmay, Dagupan City', 2.5, 'Loam', 6.0, 'Sloping', 'Sprinkler');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS006', 'P006', 'Josefina Manalo', 'Corn', 2.5, '2025-01-01', '2025-12-31', 1, 1, 0, 1, 75000, 'F006', 'Engr. Rudolfo Dimagiba', '2025-01-05', '2025-01-05');

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS006', 'Sweet Corn', 2.5, '2025-01-01', '2025-12-31', 1.0, 5000, 15);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (14, 'INS006', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (14, 'Pesticide', 20, 3000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (14, 'Land Tiller', 3, 3000);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (15, 'INS006', 15);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (15, 'Pesticide Sprayer', 2, 4500);


-- ==========================================
-- RECORD 7: Leonor Rivera (INS007)
-- ==========================================
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P007', 'Leonor Rivera', '123 Rizal St. Manila', '1985-11-20', '09998887777', NULL, 'M', 'F', 0, NULL, 'Antonio Rivera', '1982-10-10');

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F007', 'Rivera Estate', 'Brgy. Tibig, Silang, Cavite', 1.5, 'Clay', 5.8, 'Flat', 'Drip');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS007', 'P007', 'Antonio Rivera', 'Pineapple', 1.5, '2024-05-01', '2024-11-01', 1, 0, 1, 1, 40000, 'F007', 'Engr. Rizal', '2024-05-01', '2024-05-01');

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS007', 'Formosa', 1.5, '2024-05-01', '2024-11-01', 0.50, 3000, 20);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (16, 'INS007', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (16, 'Fertilizer', 10, 2000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (16, 'Planter', 5, 5000);


-- ==========================================
-- RECORD 8: Alaw Mampen (INS008)  [ACTIVE COVERAGE -> Rejected demo]
-- ==========================================
INSERT INTO ProposerTable (ProposerID, ProposerName, Address, Birthday, ContactNo, SecondaryContactNo, CivilStatus, Sex, IP, Tribe, Spouse, SpouseBirthday)
VALUES ('P008', 'Alaw Mampen', 'Lake Sebu, South Cotabato', '1978-08-08', '09112223333', NULL, 'M', 'M', 1, 'T\'boli', 'Waya Mampen', '1980-01-01');

INSERT INTO FarmTable (PlantationID, PlantationName, FarmAddress, FarmArea, SoilType, SoilPH, Topography, IrrigationType)
VALUES ('F008', 'Lake Sebu Farms', 'Lake Sebu, South Cotabato', 4.0, 'Sandy Loam', 6.5, 'Flat', 'Sprinkler');

INSERT INTO InsuranceTable (InsuranceID, ProposerID, Beneficiary, Crops, PlantationSize, CoverageStart, CoverageEnd, Flood, Typhoon, Drought, Pests, DesiredAmountCover, PlantationID, SupervisingPT, PTDate, ProposerDate)
VALUES ('INS008', 'P008', 'Waya Mampen', 'Cacao', 4.0, '2025-01-01', '2027-01-01', 1, 1, 1, 1, 200000, 'F008', 'Engr. Datu', '2025-01-01', '2025-01-01');

INSERT INTO VarietyTable (InsuranceID, Variety, AreaPlanted, DatePlanting, EstHarvestDate, AgeGroup, NumTrees, AvgYield)
VALUES ('INS008', 'Trinitario', 4.0, '2025-01-01', '2027-01-01', 2.0, 1000, 50);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (17, 'INS008', 0);
INSERT INTO CPIMaterialTable (CPIID, MaterialItem, MaterialQuantity, MaterialCost) VALUES (17, 'Pesticide', 50, 10000);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (17, 'Heavy Equipment Operator', 1, 5000);

INSERT INTO CPITable (CPIID, InsuranceID, DaysNoAfterPlanting) VALUES (18, 'INS008', 60);
INSERT INTO CPILaborTable (CPIID, LaborWorkforce, LaborQuantity, LaborCost) VALUES (18, 'Harvester', 10, 45000);


-- ==========================================
-- STATUS DEMO (FIX 5)
-- All policies default to 'Pending'. Override two so the admin status
-- dropdown shows all three states and both blocking behaviors:
--   INS005 -> Approved : un-ended coverage, still BLOCKS a re-application
--   INS008 -> Rejected : un-ended coverage, but does NOT block re-application
-- ==========================================
UPDATE InsuranceTable SET ApplicationStatus = 'Approved' WHERE InsuranceID = 'INS005';
UPDATE InsuranceTable SET ApplicationStatus = 'Rejected' WHERE InsuranceID = 'INS008';
