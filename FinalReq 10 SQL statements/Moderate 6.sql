SELECT LaborWorkforce, AVG(LaborCost) AS AvgLaborCost
FROM CPILaborTable
GROUP BY LaborWorkforce
HAVING AVG(LaborCost) > 2000;
