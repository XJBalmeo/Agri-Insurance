SELECT C.InsuranceID, SUM(CM.MaterialCost) AS Material_Cost_Sum, 
F.PlantationName, F.FarmAddress 
FROM cpitable AS C, cpimaterialtable AS CM, farmtable AS F, insurancetable AS I 
WHERE C.CpiID = CM.CpiID 
AND C.InsuranceID = I.InsuranceID 
AND I.PlantationID = F.PlantationID 
AND F.FarmAddress LIKE '%Dagupan City%' 
AND F.IrrigationType IN ('Sprinkler') 
GROUP BY C.InsuranceID 
ORDER BY Material_Cost_Sum DESC;
