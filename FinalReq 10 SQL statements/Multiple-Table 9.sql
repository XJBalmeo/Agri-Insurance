SELECT P.ProposerName, P.ContactNo, I.Crops,
	   I.DesiredAmountCover, I.CoverageStart, I.CoverageEnd
FROM InsuranceTable AS I, ProposerTable AS P
WHERE I.ProposerID = P.ProposerID
ORDER BY I.CoverageEnd ASC;
