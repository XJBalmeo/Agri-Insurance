// Tests for the validation/sanitization helpers.
// Run with: npm test  (uses Node's built-in test runner, no extra deps)
//
// `node:test` gives us `test`/`describe`, and `node:assert` gives assertions.
// Each test() is one case; assert throws if an expectation fails, which the
// runner reports as a failure.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { sanitizeApplicationData, validateApplicationData, isValidStatus, VALID_STATUSES } = require('./validators');

// A minimal payload that passes every validation rule. Individual tests clone
// this and break one field at a time, so we know any error comes from that field.
function validPayload() {
    return {
        proposerName: 'Juan dela Cruz',
        address: 'Brgy. Maligaya, Davao City',
        birthday: '1985-03-15',
        contactNo: '09171234567',
        secondaryContactNo: '',
        civilStatus: 'M',
        sex: 'M',
        beneficiary: 'Maria dela Cruz',
        plantationName: 'Sunrise Farm',
        farmAddress: 'Brgy. Maligaya, Davao City',
        farmArea: 2.5,
        soilType: 'Clay Loam',
        soilPH: 6.5,
        topography: 'Flat',
        irrigationType: 'Drip',
        crops: 'Banana',
        plantationSize: 2.5,
        desiredAmountCover: 300000,
        coverageStart: '2026-07-01',
        coverageEnd: '2026-12-31',
        supervisingPT: 'Engr. Santos',
        ptDate: '2026-06-13',
        perils: { flood: true, typhoon: false, drought: false, pests: false },
        varieties: [{
            varietyName: 'Cavendish', areaPlanted: 1, numTrees: 100, avgYield: 50,
            datePlanting: '2026-07-01', estHarvestDate: '2026-12-01',
        }],
        cpiSchedule: [
            {
                daysAfterPlanting: 30,
                materials: [{ item: 'Fertilizer', quantity: 10, cost: 500 }],
                labor: [{ workforce: 'Planters', quantity: 5, cost: 300 }],
            },
        ],
    };
}

describe('validateApplicationData', () => {
    test('accepts a fully valid payload (no errors)', () => {
        assert.deepStrictEqual(validateApplicationData(validPayload()), []);
    });

    test('rejects a missing or non-object body', () => {
        assert.deepStrictEqual(validateApplicationData(null), [
            'Request body is missing or malformed.',
        ]);
        assert.deepStrictEqual(validateApplicationData('nope'), [
            'Request body is missing or malformed.',
        ]);
    });

    test('rejects a contact number that is neither PH mobile nor landline', () => {
        const data = validPayload();
        data.contactNo = '12345'; // too short for either format
        assert.ok(validateApplicationData(data).some((e) => e.includes('Contact number')));
    });

    test('accepts a PH landline as primary or secondary contact', () => {
        const manila = validPayload();
        manila.contactNo = '0287654321'; // 02 area code + 8-digit subscriber
        assert.deepStrictEqual(validateApplicationData(manila), []);

        const provincial = validPayload();
        provincial.secondaryContactNo = '0321234567'; // 032 Cebu + 7-digit subscriber
        assert.deepStrictEqual(validateApplicationData(provincial), []);
    });

    test('rejects a 10-digit number starting with 09 (truncated mobile, not a landline)', () => {
        const data = validPayload();
        data.contactNo = '0917123456'; // no PH area code starts with 9
        assert.ok(validateApplicationData(data).some((e) => e.includes('Contact number')));
    });

    test('allows an empty secondary contact number but rejects a malformed one', () => {
        const ok = validPayload();
        ok.secondaryContactNo = '';
        assert.deepStrictEqual(validateApplicationData(ok), []);

        const bad = validPayload();
        bad.secondaryContactNo = '0917'; // too short
        assert.ok(validateApplicationData(bad).some((e) => e.includes('Secondary contact number')));
    });

    test('rejects non-positive numeric fields', () => {
        const data = validPayload();
        data.farmArea = 0;
        data.desiredAmountCover = -5;
        const errors = validateApplicationData(data);
        assert.ok(errors.some((e) => e.includes('Farm area')));
        assert.ok(errors.some((e) => e.includes('Desired amount of cover')));
    });

    test('rejects soil pH outside the 0.1 - 14.9 range', () => {
        const low = validPayload();
        low.soilPH = 0;
        assert.ok(validateApplicationData(low).some((e) => e.includes('Soil pH')));

        const high = validPayload();
        high.soilPH = 15;
        assert.ok(validateApplicationData(high).some((e) => e.includes('Soil pH')));
    });

    test('flags a bad per-variety number with the variety label', () => {
        const data = validPayload();
        data.varieties[0].numTrees = 0;
        assert.ok(validateApplicationData(data).some((e) => e.includes('Variety #1')));
    });

    test('flags a bad CPI material cost with the block/material label', () => {
        const data = validPayload();
        data.cpiSchedule[0].materials[0].cost = -1;
        assert.ok(
            validateApplicationData(data).some(
                (e) => e.includes('CPI block #1') && e.includes('material #1'),
            ),
        );
    });

    test('accepts zero days after planting (an input applied on planting day)', () => {
        const data = validPayload();
        data.cpiSchedule[0].daysAfterPlanting = 0;
        assert.deepStrictEqual(validateApplicationData(data), []);
    });

    test('still rejects negative days after planting', () => {
        const data = validPayload();
        data.cpiSchedule[0].daysAfterPlanting = -1;
        assert.ok(
            validateApplicationData(data).some(
                (e) => e.includes('CPI block #1') && e.includes('days after planting'),
            ),
        );
    });

    test('rejects a blank days after planting (missing is not day 0)', () => {
        const data = validPayload();
        data.cpiSchedule[0].daysAfterPlanting = '';
        assert.ok(
            validateApplicationData(data).some(
                (e) => e.includes('CPI block #1') && e.includes('days after planting'),
            ),
        );
    });

    test('rejects a missing perils object (guards the server-side TypeError)', () => {
        const data = validPayload();
        delete data.perils;
        assert.ok(validateApplicationData(data).some((e) => e.includes('peril')));
    });

    test('rejects a perils object with nothing selected', () => {
        const data = validPayload();
        data.perils = { flood: false, typhoon: false, drought: false, pests: false };
        assert.ok(validateApplicationData(data).some((e) => e.includes('peril')));
    });

    test('rejects coverage end that is not after coverage start', () => {
        const data = validPayload();
        data.coverageEnd = data.coverageStart; // equal — not strictly after
        assert.ok(validateApplicationData(data).some((e) => e.includes('Coverage end date')));
    });

    test('rejects an invalid or missing coverage date', () => {
        const data = validPayload();
        data.coverageEnd = '';
        assert.ok(validateApplicationData(data).some((e) => e.includes('valid dates')));
    });

    test('rejects a variety whose harvest date is before its planting date', () => {
        const data = validPayload();
        data.varieties[0].estHarvestDate = '2026-06-01'; // before the 2026-07-01 planting
        assert.ok(
            validateApplicationData(data).some(
                (e) => e.includes('Variety #1') && e.includes('harvest date'),
            ),
        );
    });

    test('requires at least one crop variety', () => {
        const data = validPayload();
        data.varieties = [];
        assert.ok(validateApplicationData(data).some((e) => e.includes('At least one crop variety')));
    });

    // --- Data Dictionary alignment: required text, allowable values, sizes ---

    test('rejects a missing required text field', () => {
        const data = validPayload();
        delete data.beneficiary;
        assert.ok(validateApplicationData(data).some((e) => e.includes('Beneficiary is required')));
    });

    test('rejects an empty required text field (blank after trim)', () => {
        const data = validPayload();
        data.crops = '   ';
        assert.ok(validateApplicationData(data).some((e) => e.includes('Crops is required')));
    });

    test('rejects a text field longer than its Data Dictionary size', () => {
        const data = validPayload();
        data.proposerName = 'X'.repeat(31); // ProposerName is VARCHAR(30)
        assert.ok(validateApplicationData(data).some((e) => e.includes('at most 30 characters')));
    });

    test('rejects a soil type longer than 20 chars (the column the bug widened to 20)', () => {
        const data = validPayload();
        data.soilType = 'X'.repeat(21);
        assert.ok(validateApplicationData(data).some((e) => e.includes('Soil type') && e.includes('at most 20')));
    });

    test('rejects civil status and sex outside the allowable set', () => {
        const badStatus = validPayload();
        badStatus.civilStatus = 'X';
        assert.ok(validateApplicationData(badStatus).some((e) => e.includes('Civil status')));

        const badSex = validPayload();
        badSex.sex = 'Z';
        assert.ok(validateApplicationData(badSex).some((e) => e.includes('Sex must be either M or F')));
    });

    test('accepts every allowable civil status (S, M, W, SE)', () => {
        ['S', 'M', 'W', 'SE'].forEach((cs) => {
            const data = validPayload();
            data.civilStatus = cs;
            assert.deepStrictEqual(validateApplicationData(data), [], `civilStatus ${cs} should pass`);
        });
    });

    test('rejects a missing birthday and PT date', () => {
        const data = validPayload();
        delete data.birthday;
        delete data.ptDate;
        const errors = validateApplicationData(data);
        assert.ok(errors.some((e) => e.includes('Birthday')));
        assert.ok(errors.some((e) => e.includes('PT date')));
    });

    test('rejects a malformed spouse birthday but allows it absent (optional)', () => {
        const bad = validPayload();
        bad.spouseBirthday = 'not-a-date';
        assert.ok(validateApplicationData(bad).some((e) => e.includes('Spouse birthday')));

        const absent = validPayload(); // no spouseBirthday key at all
        assert.deepStrictEqual(validateApplicationData(absent), []);
    });

    test('rejects numbers above the Data Dictionary size ceiling', () => {
        const data = validPayload();
        data.desiredAmountCover = 100000000000; // > DECIMAL(10,2) ceiling
        data.plantationSize = 1000;             // > DECIMAL(5,2) ceiling (999.99)
        const errors = validateApplicationData(data);
        assert.ok(errors.some((e) => e.includes('Desired amount of cover')));
        assert.ok(errors.some((e) => e.includes('Plantation size')));
    });

    test('rejects per-variety numbers above their ceilings', () => {
        const data = validPayload();
        data.varieties[0].numTrees = 100000; // integer 5 -> max 99999
        data.varieties[0].areaPlanted = 1000; // DECIMAL(5,2) -> max 999.99
        const errors = validateApplicationData(data);
        assert.ok(errors.some((e) => e.includes('Variety #1') && e.includes('number of trees')));
        assert.ok(errors.some((e) => e.includes('Variety #1') && e.includes('area planted')));
    });

    test('rejects a blank variety name and a CPI material with no item', () => {
        const noName = validPayload();
        noName.varieties[0].varietyName = '';
        assert.ok(validateApplicationData(noName).some((e) => e.includes('variety name is required')));

        const noItem = validPayload();
        noItem.cpiSchedule[0].materials[0].item = '';
        assert.ok(validateApplicationData(noItem).some((e) => e.includes('item is required')));
    });
});

describe('sanitizeApplicationData', () => {
    test('trims top-level text fields in place', () => {
        const data = { proposerName: '  Juan  ', address: ' Davao ' };
        sanitizeApplicationData(data);
        assert.strictEqual(data.proposerName, 'Juan');
        assert.strictEqual(data.address, 'Davao');
    });

    test('trims nested variety and CPI text fields', () => {
        const data = {
            varieties: [{ varietyName: '  Cavendish  ', ageGroup: ' 1-2yrs ' }],
            cpiSchedule: [
                { materials: [{ item: '  Fertilizer ' }], labor: [{ workforce: ' Planters  ' }] },
            ],
        };
        sanitizeApplicationData(data);
        assert.strictEqual(data.varieties[0].varietyName, 'Cavendish');
        assert.strictEqual(data.varieties[0].ageGroup, '1-2yrs');
        assert.strictEqual(data.cpiSchedule[0].materials[0].item, 'Fertilizer');
        assert.strictEqual(data.cpiSchedule[0].labor[0].workforce, 'Planters');
    });

    test('leaves non-string values untouched and tolerates missing arrays', () => {
        const data = { farmArea: 2.5 }; // number, no varieties/cpiSchedule
        const result = sanitizeApplicationData(data);
        assert.strictEqual(result.farmArea, 2.5);
    });
});

describe('isValidStatus', () => {
    test('accepts each of the three allowed statuses', () => {
        VALID_STATUSES.forEach((s) => assert.strictEqual(isValidStatus(s), true));
    });

    test('tolerates surrounding whitespace', () => {
        assert.strictEqual(isValidStatus('  Approved  '), true);
    });

    test('rejects wrong casing — the DB ENUM stores exact spellings', () => {
        assert.strictEqual(isValidStatus('approved'), false);
        assert.strictEqual(isValidStatus('PENDING'), false);
    });

    test('rejects empty, missing, and non-string values', () => {
        assert.strictEqual(isValidStatus(''), false);
        assert.strictEqual(isValidStatus(undefined), false);
        assert.strictEqual(isValidStatus(null), false);
        assert.strictEqual(isValidStatus(42), false);
    });

    test('rejects values outside the allowed set', () => {
        assert.strictEqual(isValidStatus('Cancelled'), false);
    });
});
