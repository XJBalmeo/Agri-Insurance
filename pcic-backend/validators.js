// ======================================================
// PHASE 3: BULLETPROOF VALIDATION (DATA INTEGRITY)
// Sanitization + validation helpers for the submit route.
// ======================================================

// Philippine mobile format: starts with "09" and is exactly 11 digits.
const PH_MOBILE_REGEX = /^09\d{9}$/;

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

// A finite number strictly greater than zero.
function isPositiveNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
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

    // --- Contact number format ---
    if (typeof data.contactNo !== 'string' || !PH_MOBILE_REGEX.test(data.contactNo)) {
        errors.push('Contact number must start with 09 and be exactly 11 digits.');
    }
    if (typeof data.secondaryContactNo === 'string' && data.secondaryContactNo !== ''
        && !PH_MOBILE_REGEX.test(data.secondaryContactNo)) {
        errors.push('Secondary contact number must start with 09 and be exactly 11 digits.');
    }

    // --- Positive numbers (must be > 0) ---
    if (!isPositiveNumber(data.farmArea)) {
        errors.push('Farm area must be a number greater than zero.');
    }
    if (!isPositiveNumber(data.desiredAmountCover)) {
        errors.push('Desired amount of cover must be a number greater than zero.');
    }
    if (!isPositiveNumber(data.plantationSize)) {
        errors.push('Plantation size must be a number greater than zero.');
    }

    // --- Soil pH range (0.1 - 14.9) ---
    const soilPH = Number(data.soilPH);
    if (!Number.isFinite(soilPH) || soilPH < 0.1 || soilPH > 14.9) {
        errors.push('Soil pH must be a number between 0.1 and 14.9.');
    }

    // --- Per-variety numbers ---
    if (Array.isArray(data.varieties)) {
        data.varieties.forEach((v, i) => {
            const label = `Variety #${i + 1}`;
            if (!isPositiveNumber(v.areaPlanted)) {
                errors.push(`${label}: area planted must be greater than zero.`);
            }
            if (!isPositiveNumber(v.numTrees)) {
                errors.push(`${label}: number of trees must be greater than zero.`);
            }
            if (!isPositiveNumber(v.avgYield)) {
                errors.push(`${label}: average yield must be greater than zero.`);
            }
        });
    }

    // --- Per-CPI-block numbers ---
    if (Array.isArray(data.cpiSchedule)) {
        data.cpiSchedule.forEach((day, i) => {
            const label = `CPI block #${i + 1}`;
            if (!isPositiveNumber(day.daysAfterPlanting)) {
                errors.push(`${label}: days after planting must be greater than zero.`);
            }
            if (Array.isArray(day.materials)) {
                day.materials.forEach((mat, j) => {
                    if (!isPositiveNumber(mat.quantity)) {
                        errors.push(`${label}, material #${j + 1}: quantity must be greater than zero.`);
                    }
                    if (!isPositiveNumber(mat.cost)) {
                        errors.push(`${label}, material #${j + 1}: cost must be greater than zero.`);
                    }
                });
            }
            if (Array.isArray(day.labor)) {
                day.labor.forEach((lab, j) => {
                    if (!isPositiveNumber(lab.quantity)) {
                        errors.push(`${label}, labor #${j + 1}: quantity must be greater than zero.`);
                    }
                    if (!isPositiveNumber(lab.cost)) {
                        errors.push(`${label}, labor #${j + 1}: cost must be greater than zero.`);
                    }
                });
            }
        });
    }

    return errors;
}

module.exports = { sanitizeApplicationData, validateApplicationData };
