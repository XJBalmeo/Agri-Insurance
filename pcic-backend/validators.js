// ======================================================
// PHASE 3: BULLETPROOF VALIDATION (DATA INTEGRITY)
// Sanitization + validation helpers for the submit route.
// ======================================================

// Philippine mobile format: starts with "09" and is exactly 11 digits.
const PH_MOBILE_REGEX = /^09\d{9}$/;

// Philippine landline format: exactly 10 digits — "0" + area code + subscriber
// number, e.g. 0287654321 (Metro Manila, 02 + 8 digits) or 0321234567 (Cebu,
// 032 + 7 digits). The first digit after "0" is 2-8: no PH area code starts
// with 9, so a 10-digit "09..." is a mistyped mobile and stays rejected.
const PH_LANDLINE_REGEX = /^0[2-8]\d{8}$/;

// A contact number is valid if it matches either format.
function isPhContactNumber(value) {
    return typeof value === 'string'
        && (PH_MOBILE_REGEX.test(value) || PH_LANDLINE_REGEX.test(value));
}

// Text fields that should be trimmed before saving to MySQL.
const TOP_LEVEL_TEXT_FIELDS = [
    'proposerName', 'address', 'contactNo', 'secondaryContactNo', 'beneficiary',
    'spouse', 'tribe', 'civilStatus', 'sex', 'plantationName', 'farmAddress',
    'soilType', 'topography', 'irrigationType', 'crops', 'supervisingPT'
];

// Trim a single string field on an object in place (skips non-strings).
function trimField(obj, key) {
    if (obj && typeof obj[key] === 'string') {
        obj[key] = obj[key].trim();
    }
}

// A non-empty, parseable calendar date string (e.g. 'YYYY-MM-DD').
function isValidDate(value) {
    return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

// A trimmed, non-empty string.
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

// A finite number strictly greater than zero that also fits the column's
// dictionary "size" ceiling (so oversize values become a clean 400, not a
// MySQL out-of-range 500).
function isPositiveWithinMax(value, max) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= max;
}

// Max VARCHAR/CHAR lengths, mirroring the Data Dictionary and schema.sql.
const MAX_LENGTHS = {
    proposerName: 30, address: 100, contactNo: 15, secondaryContactNo: 15,
    beneficiary: 30, spouse: 30, tribe: 20, plantationName: 20, farmAddress: 100,
    soilType: 20, topography: 20, irrigationType: 20, crops: 20, supervisingPT: 30,
    varietyName: 20, ageGroup: 10, materialItem: 30, laborWorkforce: 30,
};

// Numeric ceilings from the Data Dictionary "size" column, read as total
// digits: float 10 -> DECIMAL(10,2), float 5 -> DECIMAL(5,2), integer 5 -> 99999.
const MAX_VALUES = {
    desiredAmountCover: 99999999.99,  // DECIMAL(10,2)
    plantationSize: 999.99,           // DECIMAL(5,2)
    farmArea: 999.99,                 // DECIMAL(5,2)
    areaPlanted: 999.99,              // DECIMAL(5,2)
    avgYield: 9999.9,                 // DECIMAL(5,1)
    materialCost: 99999999.99,        // DECIMAL(10,2)
    laborCost: 99999999.99,           // DECIMAL(10,2)
    numTrees: 99999,                  // integer 5
    daysAfterPlanting: 99999,         // integer 5 (matches the form's maxlength)
    materialQuantity: 99999,          // integer 5
    laborQuantity: 99999,             // integer 5
};

// Required free-text fields, paired with the label used in error messages.
// Identity/date fields (birthday, ptDate) are validated separately as dates.
const REQUIRED_TEXT_FIELDS = [
    ['proposerName', 'Proposer name'],
    ['address', 'Address'],
    ['beneficiary', 'Beneficiary'],
    ['plantationName', 'Plantation name'],
    ['farmAddress', 'Farm address'],
    ['soilType', 'Soil type'],
    ['topography', 'Topography'],
    ['irrigationType', 'Irrigation type'],
    ['crops', 'Crops'],
    ['supervisingPT', 'Supervising PT'],
];

// Allowable values from the Data Dictionary.
const CIVIL_STATUSES = ['S', 'M', 'W', 'SE'];
const SEXES = ['M', 'F'];

// Mirrors the ApplicationStatus ENUM in schema.sql — keep the two in sync.
const VALID_STATUSES = ['Pending', 'Approved', 'Rejected'];

// Case-sensitive on purpose: the DB stores these exact spellings, and the
// admin UI only ever sends them verbatim.
function isValidStatus(value) {
    return typeof value === 'string' && VALID_STATUSES.includes(value.trim());
}

/**
 * Trim leading/trailing whitespace from every text input, including nested
 * varieties and CPI material/labor rows. Mutates `data` in place.
 */
function sanitizeApplicationData(data) {
    if (!data || typeof data !== 'object') return data;

    TOP_LEVEL_TEXT_FIELDS.forEach((field) => trimField(data, field));

    if (Array.isArray(data.varieties)) {
        data.varieties.forEach((v) => {
            trimField(v, 'varietyName');
            trimField(v, 'ageGroup');
        });
    }

    if (Array.isArray(data.cpiSchedule)) {
        data.cpiSchedule.forEach((day) => {
            if (Array.isArray(day.materials)) {
                day.materials.forEach((mat) => trimField(mat, 'item'));
            }
            if (Array.isArray(day.labor)) {
                day.labor.forEach((lab) => trimField(lab, 'workforce'));
            }
        });
    }

    return data;
}

/**
 * Validate the application payload. Returns an array of human-readable error
 * messages; an empty array means the payload is valid.
 */
function validateApplicationData(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        return ['Request body is missing or malformed.'];
    }

    // --- Required free-text fields + max length (Data Dictionary sizes) ---
    // The browser enforces these too, but this endpoint is public, so a direct
    // API call must not be able to persist blank/oversize values into NOT NULL
    // columns (or overflow them into a 500).
    REQUIRED_TEXT_FIELDS.forEach(([field, label]) => {
        if (!isNonEmptyString(data[field])) {
            errors.push(`${label} is required.`);
        } else if (data[field].length > MAX_LENGTHS[field]) {
            errors.push(`${label} must be at most ${MAX_LENGTHS[field]} characters.`);
        }
    });

    // Optional text fields: length-checked only when actually provided.
    ['secondaryContactNo', 'spouse', 'tribe'].forEach((field) => {
        if (isNonEmptyString(data[field]) && data[field].length > MAX_LENGTHS[field]) {
            errors.push(`${field} must be at most ${MAX_LENGTHS[field]} characters.`);
        }
    });

    // --- Allowable values (Data Dictionary) ---
    if (!CIVIL_STATUSES.includes(data.civilStatus)) {
        errors.push('Civil status must be one of: S, M, W, SE.');
    }
    if (!SEXES.includes(data.sex)) {
        errors.push('Sex must be either M or F.');
    }

    // --- Identity & signature dates ---
    // Birthday is half the proposer identity key; PT date is NOT NULL in schema.
    if (!isValidDate(data.birthday)) {
        errors.push('Birthday is required and must be a valid date.');
    }
    if (!isValidDate(data.ptDate)) {
        errors.push('PT date is required and must be a valid date.');
    }
    // ProposerDate is optional (defaults to today client-side) — only checked if sent.
    if (isNonEmptyString(data.proposerDate) && !isValidDate(data.proposerDate)) {
        errors.push('Proposer date must be a valid date.');
    }
    // SpouseBirthday is optional (nullable in the dictionary) — only checked if
    // sent, so a malformed value becomes a 400 instead of a DB insert 500.
    if (isNonEmptyString(data.spouseBirthday) && !isValidDate(data.spouseBirthday)) {
        errors.push('Spouse birthday must be a valid date.');
    }

    // --- Contact number format (mobile or landline) ---
    if (!isPhContactNumber(data.contactNo)) {
        errors.push('Contact number must be a valid Philippine phone number.');
    }
    if (typeof data.secondaryContactNo === 'string' && data.secondaryContactNo !== ''
        && !isPhContactNumber(data.secondaryContactNo)) {
        errors.push('Secondary contact number must be a valid Philippine phone number.');
    }

    // --- Perils: must be an object with at least one peril selected ---
    // Guards server.js reading data.perils.flood etc. — a missing `perils`
    // would otherwise throw a TypeError and surface as a 500 with leaked internals.
    if (!data.perils || typeof data.perils !== 'object'
        || !(data.perils.flood || data.perils.typhoon || data.perils.drought || data.perils.pests)) {
        errors.push('At least one peril (flood, typhoon, drought, or pests) must be selected.');
    }

    // --- Coverage dates: both valid, and end strictly after start ---
    if (!isValidDate(data.coverageStart) || !isValidDate(data.coverageEnd)) {
        errors.push('Coverage start and end dates are required and must be valid dates.');
    } else if (new Date(data.coverageStart) >= new Date(data.coverageEnd)) {
        errors.push('Coverage end date must be after the coverage start date.');
    }

    // --- Positive numbers, capped at the Data Dictionary size ceilings ---
    if (!isPositiveWithinMax(data.farmArea, MAX_VALUES.farmArea)) {
        errors.push(`Farm area must be greater than zero and at most ${MAX_VALUES.farmArea}.`);
    }
    if (!isPositiveWithinMax(data.desiredAmountCover, MAX_VALUES.desiredAmountCover)) {
        errors.push(`Desired amount of cover must be greater than zero and at most ${MAX_VALUES.desiredAmountCover}.`);
    }
    if (!isPositiveWithinMax(data.plantationSize, MAX_VALUES.plantationSize)) {
        errors.push(`Plantation size must be greater than zero and at most ${MAX_VALUES.plantationSize}.`);
    }

    // --- Soil pH range (0.1 - 14.9) ---
    const soilPH = Number(data.soilPH);
    if (!Number.isFinite(soilPH) || soilPH < 0.1 || soilPH > 14.9) {
        errors.push('Soil pH must be a number between 0.1 and 14.9.');
    }

    // --- At least one crop variety is required ---
    if (!Array.isArray(data.varieties) || data.varieties.length === 0) {
        errors.push('At least one crop variety is required.');
    }

    // --- Per-variety text, numbers, and dates ---
    if (Array.isArray(data.varieties)) {
        data.varieties.forEach((v, i) => {
            const label = `Variety #${i + 1}`;
            if (!isNonEmptyString(v.varietyName)) {
                errors.push(`${label}: variety name is required.`);
            } else if (v.varietyName.length > MAX_LENGTHS.varietyName) {
                errors.push(`${label}: variety name must be at most ${MAX_LENGTHS.varietyName} characters.`);
            }
            if (isNonEmptyString(v.ageGroup) && v.ageGroup.length > MAX_LENGTHS.ageGroup) {
                errors.push(`${label}: age group must be at most ${MAX_LENGTHS.ageGroup} characters.`);
            }
            if (!isPositiveWithinMax(v.areaPlanted, MAX_VALUES.areaPlanted)) {
                errors.push(`${label}: area planted must be greater than zero and at most ${MAX_VALUES.areaPlanted}.`);
            }
            if (!isPositiveWithinMax(v.numTrees, MAX_VALUES.numTrees)) {
                errors.push(`${label}: number of trees must be greater than zero and at most ${MAX_VALUES.numTrees}.`);
            }
            if (!isPositiveWithinMax(v.avgYield, MAX_VALUES.avgYield)) {
                errors.push(`${label}: average yield must be greater than zero and at most ${MAX_VALUES.avgYield}.`);
            }
            if (!isValidDate(v.datePlanting) || !isValidDate(v.estHarvestDate)) {
                errors.push(`${label}: planting and harvest dates are required and must be valid dates.`);
            } else if (new Date(v.datePlanting) >= new Date(v.estHarvestDate)) {
                errors.push(`${label}: harvest date must be after the planting date.`);
            }
        });
    }

    // --- Per-CPI-block text and numbers ---
    if (Array.isArray(data.cpiSchedule)) {
        data.cpiSchedule.forEach((day, i) => {
            const label = `CPI block #${i + 1}`;
            if (!isPositiveWithinMax(day.daysAfterPlanting, MAX_VALUES.daysAfterPlanting)) {
                errors.push(`${label}: days after planting must be greater than zero and at most ${MAX_VALUES.daysAfterPlanting}.`);
            }
            if (Array.isArray(day.materials)) {
                day.materials.forEach((mat, j) => {
                    const mLabel = `${label}, material #${j + 1}`;
                    if (!isNonEmptyString(mat.item)) {
                        errors.push(`${mLabel}: item is required.`);
                    } else if (mat.item.length > MAX_LENGTHS.materialItem) {
                        errors.push(`${mLabel}: item must be at most ${MAX_LENGTHS.materialItem} characters.`);
                    }
                    if (!isPositiveWithinMax(mat.quantity, MAX_VALUES.materialQuantity)) {
                        errors.push(`${mLabel}: quantity must be greater than zero and at most ${MAX_VALUES.materialQuantity}.`);
                    }
                    if (!isPositiveWithinMax(mat.cost, MAX_VALUES.materialCost)) {
                        errors.push(`${mLabel}: cost must be greater than zero and at most ${MAX_VALUES.materialCost}.`);
                    }
                });
            }
            if (Array.isArray(day.labor)) {
                day.labor.forEach((lab, j) => {
                    const lLabel = `${label}, labor #${j + 1}`;
                    if (!isNonEmptyString(lab.workforce)) {
                        errors.push(`${lLabel}: workforce is required.`);
                    } else if (lab.workforce.length > MAX_LENGTHS.laborWorkforce) {
                        errors.push(`${lLabel}: workforce must be at most ${MAX_LENGTHS.laborWorkforce} characters.`);
                    }
                    if (!isPositiveWithinMax(lab.quantity, MAX_VALUES.laborQuantity)) {
                        errors.push(`${lLabel}: quantity must be greater than zero and at most ${MAX_VALUES.laborQuantity}.`);
                    }
                    if (!isPositiveWithinMax(lab.cost, MAX_VALUES.laborCost)) {
                        errors.push(`${lLabel}: cost must be greater than zero and at most ${MAX_VALUES.laborCost}.`);
                    }
                });
            }
        });
    }

    return errors;
}

module.exports = { sanitizeApplicationData, validateApplicationData, isValidStatus, VALID_STATUSES };
