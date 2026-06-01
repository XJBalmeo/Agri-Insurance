SELECT P.ProposerName, P.Tribe, I.Beneficiary
FROM proposertable AS P, insurancetable AS I
WHERE P.ProposerID = I.ProposerID AND P.IP = 1 AND P.Sex ='M';
