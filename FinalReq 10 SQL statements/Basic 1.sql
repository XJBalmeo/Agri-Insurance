SELECT InsuranceID, ProposerID, DesiredAmountCover
FROM insurancetable
WHERE DesiredAmountCover >= 50000 AND PlantationSize >= 2
ORDER BY DesiredAmountCover;