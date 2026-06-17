SELECT COUNT(*) AS TotalInsurances, SUM(DesiredAmountCover) AS TotalCoverage, AVG(DesiredAmountCover) AS AvgCoverage
FROM InsuranceTable;
