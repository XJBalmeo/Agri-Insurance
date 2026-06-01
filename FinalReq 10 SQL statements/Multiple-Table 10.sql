SELECT P.ProposerName, P.ContactNo, I.Crops,
		   I.DesiredAmountCover, 
		   SUM(CL.LaborCost) AS TotalLaborCost,
		   I.DesiredAmountCover - SUM(CL.LaborCost) AS RemainingCoverage
FROM ProposerTable AS P, InsuranceTable AS I,
		CPITable AS C, CPILaborTable AS CL
WHERE P.ProposerID = I.ProposerID
   		   AND I.InsuranceID = C.InsuranceID
   AND C.CpiID = CL.CpiID
GROUP BY P.ProposerName, P.ContactNo, I.Crops, I.DesiredAmountCover
ORDER BY RemainingCoverage ASC;
