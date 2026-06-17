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

// Derive the crop's "age group" — a decimal age in years (e.g. 0.42 = 5 months)
// computed from the planting date up to the estimated harvest date (or today,
// if no harvest date is given). This is the single source of truth: the client
// computes the same value for display, but the backend recomputes it on write
// so a tampered or stale submitted value can never reach the database. Mirrors
// the frontend calcAge() in script.js exactly. Returns null if planting is not
// a valid date, or '0.00' if planting somehow falls after the target date.
function computeAgeGroup(plantingStr, harvestStr) {
    if (!isValidDate(plantingStr)) return null;

    const planted = new Date(plantingStr);
    const target  = isValidDate(harvestStr) ? new Date(harvestStr) : new Date();

    if (planted > target) return '0.00';

    let yrs = target.getFullYear() - planted.getFullYear();
    let mos = target.getMonth() - planted.getMonth();
    if (target.getDate() < planted.getDate()) mos--;   // day-of-month not reached yet
    if (mos < 0) { yrs--; mos += 12; }                 // borrow a year

    return (yrs + mos / 12).toFixed(2);
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

// Like isPositiveWithinMax, but allows zero. Used for "days after planting",
// where 0 legitimately means "on the planting day itself." A blank/missing
// value is rejected outright — Number('') is 0, so we must guard it before
// coercion, otherwise an empty field would masquerade as a valid day 0.
function isNonNegativeWithinMax(value, max) {
    if (value === '' || value === null || value === undefined) return false;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= max;
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
            if (!isNonNegativeWithinMax(day.daysAfterPlanting, MAX_VALUES.daysAfterPlanting)) {
                errors.push(`${label}: days after planting must be zero or greater and at most ${MAX_VALUES.daysAfterPlanting}.`);
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

// ======================================================
// ADMIN ROW EDITING — per-table "editable column" schemas
// ======================================================
// Each table lists ONLY the columns an admin is allowed to change. Three kinds
// of column are deliberately ABSENT, which is what keeps editing safe:
//   * Primary keys (ProposerID, LaborID, …) — the PK identifies the row, so it
//     is only ever used in the WHERE clause, never in SET. (You confirmed this:
//     primary keys must not be editable.)
//   * Foreign keys (CPIID, ProposerID, PlantationID on child tables) — leaving
//     them out means an edit can never re-point a row to a different parent and
//     orphan it.
//   * Joined display columns (ProposerName / PlantationName shown in the admin
//     child tables) — those aren't real columns of the table being edited.
// VarietyTable is intentionally missing entirely: it has no primary key, so a
// single variety row can't be targeted by a WHERE clause (same reason Delete
// skips it).
//
// Each column's `type` drives both validation here and the input widget the
// admin page renders. `max` mirrors the Data Dictionary ceilings already used
// above so an edit can't slip past the limits the public form enforces.
const ROW_SCHEMAS = {
    proposer: {
        table: 'ProposerTable',
        idColumn: 'ProposerID',
        columns: {
            ProposerName:       { type: 'text',  required: true,  max: 30 },
            Address:            { type: 'text',  required: true,  max: 100 },
            Birthday:           { type: 'date',  required: true },
            ContactNo:          { type: 'phone', required: true },
            SecondaryContactNo: { type: 'phone', required: false },
            CivilStatus:        { type: 'enum',  options: CIVIL_STATUSES },
            Sex:                { type: 'enum',  options: SEXES },
            IP:                 { type: 'bool' },
            Tribe:              { type: 'text',  required: false, max: 20 },
            Spouse:             { type: 'text',  required: false, max: 30 },
            SpouseBirthday:     { type: 'date',  required: false },
        },
    },
    farm: {
        table: 'FarmTable',
        idColumn: 'PlantationID',
        columns: {
            PlantationName: { type: 'text',   required: true, max: 20 },
            FarmAddress:    { type: 'text',   required: true, max: 100 },
            FarmArea:       { type: 'number', required: true, max: MAX_VALUES.farmArea },
            SoilType:       { type: 'text',   required: true, max: 20 },
            // Soil pH has its own range (0.1–14.9) rather than a simple "> 0".
            SoilPH:         { type: 'number', required: true, min: 0.1, max: 14.9 },
            Topography:     { type: 'text',   required: true, max: 20 },
            IrrigationType: { type: 'text',   required: true, max: 20 },
        },
    },
    insurance: {
        table: 'InsuranceTable',
        idColumn: 'InsuranceID',
        columns: {
            Beneficiary:        { type: 'text',   required: true, max: 30 },
            Crops:              { type: 'text',   required: true, max: 20 },
            PlantationSize:     { type: 'number', required: true, max: MAX_VALUES.plantationSize },
            CoverageStart:      { type: 'date',   required: true },
            CoverageEnd:        { type: 'date',   required: true },
            Flood:              { type: 'bool' },
            Typhoon:            { type: 'bool' },
            Drought:            { type: 'bool' },
            Pests:              { type: 'bool' },
            DesiredAmountCover: { type: 'number', required: true, max: MAX_VALUES.desiredAmountCover },
            SupervisingPT:      { type: 'text',   required: true, max: 30 },
            PTDate:             { type: 'date',   required: true },
            ProposerDate:       { type: 'date',   required: false },
            ApplicationStatus:  { type: 'enum',   options: VALID_STATUSES },
        },
    },
    cpi: {
        table: 'CPITable',
        idColumn: 'CPIID',
        columns: {
            // 0 is valid here ("on the planting day itself"), so allowZero.
            DaysNoAfterPlanting: { type: 'number', required: true, integer: true, allowZero: true, max: MAX_VALUES.daysAfterPlanting },
        },
    },
    cpilabor: {
        table: 'CPILaborTable',
        idColumn: 'LaborID',
        columns: {
            LaborWorkforce: { type: 'text',   required: true, max: MAX_LENGTHS.laborWorkforce },
            LaborQuantity:  { type: 'number', required: true, integer: true, max: MAX_VALUES.laborQuantity },
            LaborCost:      { type: 'number', required: true, max: MAX_VALUES.laborCost },
        },
    },
    cpimaterial: {
        table: 'CPIMaterialTable',
        idColumn: 'MaterialID',
        columns: {
            MaterialItem:     { type: 'text',   required: true, max: MAX_LENGTHS.materialItem },
            MaterialQuantity: { type: 'number', required: true, integer: true, max: MAX_VALUES.materialQuantity },
            MaterialCost:     { type: 'number', required: true, max: MAX_VALUES.materialCost },
        },
    },
    // Variety has no surrogate key: its dedicated PUT route addresses a row by
    // the (InsuranceID, Variety) pair, so InsuranceID is omitted here (it's the
    // parent FK, never edited). Variety itself IS editable — a rename rewrites
    // the row, and the UNIQUE key rejects a clash with another variety.
    variety: {
        table: 'VarietyTable',
        keyColumns: ['InsuranceID', 'Variety'],
        columns: {
            Variety:        { type: 'text',   required: true, max: MAX_LENGTHS.varietyName },
            AreaPlanted:    { type: 'number', required: true, max: MAX_VALUES.areaPlanted },
            DatePlanting:   { type: 'date',   required: true },
            EstHarvestDate: { type: 'date',   required: true },
            // AgeGroup is intentionally NOT listed: it is a derived field, not
            // hand-editable. It is recomputed from the dates below, so any value
            // the admin form submits for it is ignored.
            NumTrees:       { type: 'number', required: true, integer: true, max: MAX_VALUES.numTrees },
            AvgYield:       { type: 'number', required: true, max: MAX_VALUES.avgYield },
        },
    },
};

// Validate one numeric edit field, pushing a message onto `errors` if it fails.
// Mirrors the rules in isPositiveWithinMax / isNonNegativeWithinMax above, but
// reads its bounds from the column descriptor so each column can differ
// (e.g. SoilPH's 0.1 floor, "days after planting" allowing zero).
function validateNumberField(value, col, label, errors) {
    // Number('') is 0, so an empty field must be caught before coercion —
    // otherwise a blank input would masquerade as a valid 0.
    if (value === '' || value === null || value === undefined) {
        errors.push(`${label} is required and must be a number.`);
        return;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
        errors.push(`${label} must be a number.`);
        return;
    }
    if (col.integer && !Number.isInteger(n)) {
        errors.push(`${label} must be a whole number.`);
        return;
    }
    if (col.min !== undefined) {
        if (n < col.min) errors.push(`${label} must be at least ${col.min}.`);
    } else if (col.allowZero) {
        if (n < 0) errors.push(`${label} must be zero or greater.`);
    } else if (n <= 0) {
        errors.push(`${label} must be greater than zero.`);
    }
    if (col.max !== undefined && n > col.max) {
        errors.push(`${label} must be at most ${col.max}.`);
    }
}

/**
 * Validate + sanitize an admin row edit against ROW_SCHEMAS[tableName].
 * Returns { errors, values }:
 *   - errors: human-readable messages (empty array means valid)
 *   - values: { ColumnName: cleanValue } ready to bind into an UPDATE; only
 *     trustworthy when errors is empty.
 * Every editable column for the table is expected in `body` (the admin form
 * sends them all, pre-filled), so a successful edit rewrites the whole set of
 * editable columns at once.
 */
function validateRowUpdate(tableName, body) {
    const schema = ROW_SCHEMAS[tableName];
    if (!schema) return { errors: ['This table cannot be edited.'], values: {} };
    if (!body || typeof body !== 'object') {
        return { errors: ['Request body is missing or malformed.'], values: {} };
    }

    const errors = [];
    const values = {};

    for (const [name, col] of Object.entries(schema.columns)) {
        const raw = body[name];

        if (col.type === 'text') {
            const v = typeof raw === 'string' ? raw.trim() : '';
            if (v === '') {
                if (col.required) errors.push(`${name} is required.`);
                else values[name] = null;          // optional + blank -> NULL
            } else if (v.length > col.max) {
                errors.push(`${name} must be at most ${col.max} characters.`);
            } else {
                values[name] = v;
            }
        } else if (col.type === 'date') {
            const v = typeof raw === 'string' ? raw.trim() : '';
            if (v === '') {
                if (col.required) errors.push(`${name} is required.`);
                else values[name] = null;
            } else if (!isValidDate(v)) {
                errors.push(`${name} must be a valid date.`);
            } else {
                values[name] = v;
            }
        } else if (col.type === 'phone') {
            const v = typeof raw === 'string' ? raw.trim() : '';
            if (v === '') {
                if (col.required) errors.push(`${name} is required.`);
                else values[name] = null;
            } else if (!isPhContactNumber(v)) {
                errors.push(`${name} must be a valid Philippine phone number.`);
            } else {
                values[name] = v;
            }
        } else if (col.type === 'enum') {
            const v = typeof raw === 'string' ? raw.trim() : raw;
            if (!col.options.includes(v)) {
                errors.push(`${name} must be one of: ${col.options.join(', ')}.`);
            } else {
                values[name] = v;
            }
        } else if (col.type === 'bool') {
            // Accept the dropdown's '1'/'0' as well as real booleans/numbers.
            const truthy = raw === true  || raw === 1 || raw === '1';
            const falsy  = raw === false || raw === 0 || raw === '0';
            if (!truthy && !falsy) errors.push(`${name} must be Yes or No.`);
            else values[name] = truthy ? 1 : 0;
        } else if (col.type === 'number') {
            const before = errors.length;
            validateNumberField(raw, col, name, errors);
            if (errors.length === before) values[name] = Number(raw);
        }
    }

    // Cross-field rule (insurance only): coverage must end after it starts.
    if (tableName === 'insurance' && values.CoverageStart && values.CoverageEnd
        && new Date(values.CoverageStart) >= new Date(values.CoverageEnd)) {
        errors.push('Coverage end date must be after the coverage start date.');
    }

    // Cross-field rule (variety only): harvest must come after planting —
    // the same check the application form enforces when a policy is created.
    if (tableName === 'variety' && values.DatePlanting && values.EstHarvestDate
        && new Date(values.DatePlanting) >= new Date(values.EstHarvestDate)) {
        errors.push('Estimated harvest date must be after the planting date.');
    }

    // Derive AgeGroup from the (validated) dates so the stored value always
    // matches the planting/harvest pair — never a value the client supplied.
    // Only when both dates passed validation; otherwise we'd compute from junk.
    if (tableName === 'variety' && errors.length === 0
        && values.DatePlanting && values.EstHarvestDate) {
        values.AgeGroup = computeAgeGroup(values.DatePlanting, values.EstHarvestDate);
    }

    return { errors, values };
}

module.exports = {
    sanitizeApplicationData, validateApplicationData, isValidStatus, VALID_STATUSES,
    ROW_SCHEMAS, validateRowUpdate, computeAgeGroup,
};
