'use strict';

/* ── State ────────────────────────────────────────────────────── */
const DEV_MODE = false; //  SET TO FALSE BEFORE DEPLOYING!
let cur = 0;
const TOTAL = 6;

const LABELS = [
  'Personal Information',
  'Insurance Coverage',
  'Farm Overview',
  'Crop Variety & Irrigation',
  'Cost of Production Inputs',
  'Validation & Signatures',
];

/* ── Required fields per step ────────────────────────────────── */
const REQUIRED = {
  0: ['proposerName', 'address', 'birthday', 'civilStatus', 'sex', 'beneficiary'],
  1: ['crops', 'plantationSize', 'coverageStart', 'coverageEnd', 'desiredCover'],
  2: ['plantationName', 'farmAddress', 'farmArea', 'soilType', 'soilPH', 'topography'],
  3: [
    'variety', 'areaPlanted', 'datePlanting', 'estHarvest',
    'hillsNum', 'irrigationType', 'treesNum', 'avgYield',
  ],
  4: [], // CPI has its own check below
  5: ['supervisingPT', 'ptDate', 'proposeDate'],
};

/* ── Field constraints (maxlength / max / min) ───────────────── */
// Applied on DOMContentLoaded so DB limits are enforced in-browser
const FIELD_CONSTRAINTS = [
  { id: 'soilType',       maxlength: 20  },
  { id: 'topography',     maxlength: 20  },
  { id: 'variety',        maxlength: 20  },
  { id: 'irrigationType', maxlength: 20  },
  { id: 'supervisingPT',  maxlength: 30  },
  { id: 'desiredCover',   max: 99999     },
  { id: 'soilPH',         min: 0.1, max: 14.9 },
];

/* ══════════════════════════════════════════════════════════════
   VALIDATION
══════════════════════════════════════════════════════════════ */

/**
 * Validates all required fields for a given step index.
 * Adds .field-error to empty inputs, shows a toast, returns bool.
 */
function validateStep(step) {
  //  DEV MODE: Instantly approve the step without checking anything
  if (DEV_MODE) return true;
  // Clear previous error highlights
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('field-error');
  });

  let valid = true;
  const requiredIds = REQUIRED[step] ?? [];

  // Check all basic required fields
  requiredIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isEmpty = el.value.trim() === '';
    if (isEmpty) {
      el.classList.add('field-error');
      valid = false;
    }
  });

  // Step 0 — Contact numbers: at least one tag must be added
  if (step === 0) {
    const tags = document.querySelectorAll('#contactWrap .tag');
    if (tags.length === 0) {
      document.getElementById('contactWrap')?.classList.add('field-error');
      valid = false;
    }
  }

  // Step 1 — Perils & Coverage Dates
  if (step === 1) {
    // 1. Check Perils
    const perilChecked = ['perilFlood', 'perilDrought', 'perilTyphoon', 'perilPest']
      .some(id => document.getElementById(id)?.checked);
    if (!perilChecked) {
      const perilSection = document.querySelector('#page-1 .custom-checkbox-label');
      perilSection?.closest('div')?.classList.add('field-error');
      valid = false;
    }

    // 2. Check Chronological Dates
    const start = document.getElementById('coverageStart')?.value;
    const end = document.getElementById('coverageEnd')?.value;
    if (start && end && new Date(start) >= new Date(end)) {
      document.getElementById('coverageEnd').classList.add('field-error');
      showToast('Coverage end date must be after the start date.');
      valid = false;
    }
  }

  // Step 3 — Validate Planting vs Harvest Dates
  if (step === 3) {
    // Check Variety 1 Dates
    const planted1 = document.getElementById('datePlanting')?.value;
    const harvest1 = document.getElementById('estHarvest')?.value;
    if (planted1 && harvest1 && new Date(planted1) >= new Date(harvest1)) {
      document.getElementById('estHarvest').classList.add('field-error');
      showToast('Harvest date must be after the planting date.');
      valid = false;
    }

    // Check Variety 2 (ONLY if it is currently visible)
    const block2 = document.getElementById('varietyBlock2');
    if (block2 && !block2.classList.contains('hidden')) {
      const requiredBlock2 = ['variety2', 'areaPlanted2', 'datePlanting2', 'estHarvest2'];
      
      requiredBlock2.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value.trim() === '') {
          el.classList.add('field-error');
          valid = false;
        }
      });

      // Check Variety 2 Dates
      const planted2 = document.getElementById('datePlanting2')?.value;
      const harvest2 = document.getElementById('estHarvest2')?.value;
      if (planted2 && harvest2 && new Date(planted2) >= new Date(harvest2)) {
        document.getElementById('estHarvest2').classList.add('field-error');
        showToast('Second variety harvest date must be after its planting date.');
        valid = false;
      }
    }
  }

  // Step 4 — CPI Blocks (Must have DAP & No Duplicates)
  if (step === 4) {
    const dapInputs = [...document.querySelectorAll('.dap-input')];
    const dapValues = dapInputs.map(i => i.value.trim()).filter(v => v !== '');

    if (dapValues.length === 0) {
      dapInputs.forEach(i => i.classList.add('field-error'));
      valid = false;
    } else {
      // Check for duplicate days using a Set
      const uniqueDaps = new Set(dapValues);
      if (dapValues.length !== uniqueDaps.size) {
        showToast('Cannot have multiple schedules for the same Day After Planting.');
        valid = false; 
      }
    }
  }

  // Final fallback toast if basic fields are missing
  if (!valid) {
    const existingToast = document.getElementById('pcic-toast');
    if (!existingToast) {
        showToast('Please fill in all required fields correctly before continuing.');
    }
  }

  return valid;
}


/* ── Clear error highlight when user starts typing / selecting ── */
function clearErrorOnInput(el) {
  el.addEventListener('input',  () => el.classList.remove('field-error'));
  el.addEventListener('change', () => el.classList.remove('field-error'));
}

/* ── Toast ────────────────────────────────────────────────────── */
function showToast(msg, type = 'error') {
  document.getElementById('pcic-toast')?.remove();

  const colors = {
    error:   { bg: '#1f2937', icon: '⚠️' },
    success: { bg: '#0F6E56', icon: '✓'  },
  };
  const { bg, icon } = colors[type] ?? colors.error;

  const toast = document.createElement('div');
  toast.id = 'pcic-toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(0);
    background: ${bg}; color: #fff;
    font-size: 0.8125rem; font-family: 'DM Sans', sans-serif;
    padding: 10px 22px; border-radius: 999px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.22);
    z-index: 9999; white-space: nowrap;
    animation: pcicFadeUp 0.22s ease forwards;
  `;
  toast.textContent = `${icon}  ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 3200);
}

/* ══════════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════════ */

function goTo(n) {
  if (n === cur) return;

  // Prevent jumping to a future step — validate each skipped step
  if (n > cur) {
    showToast('Complete the current step first.');
    return;
  }

  document.getElementById(`page-${cur}`).classList.remove('active');
  cur = n;
  document.getElementById(`page-${cur}`).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (!validateStep(cur)) return;   // ← blocked until valid

  if (cur === TOTAL - 1) {
    // 1. Change button to show loading state
    const btnNext = document.getElementById('btnNext');
    const originalText = btnNext.innerHTML;
    btnNext.innerHTML = '<i class="ti ti-loader animate-spin text-sm"></i> Submitting...';
    btnNext.disabled = true;

    // 2. Extract Contact Tags (Grabs the first two)
    const tagElements = Array.from(document.querySelectorAll('#contactWrap .tag'));
    const contacts = tagElements.map(t => t.textContent.replace('×', '').trim());

    // 3. Build the CPI Schedule Array dynamically
    const cpiSchedule = [];
    document.querySelectorAll('.cpi-block').forEach(block => {
       const dap = parseInt(block.querySelector('.dap-input').value) || 0;
       
       const materials = [];
       block.querySelectorAll('.mat-body tr').forEach(tr => {
          const inputs = tr.querySelectorAll('input');
          if (inputs[0].value) { // If item name exists
             materials.push({ 
               item: inputs[0].value, 
               quantity: parseInt(inputs[1].value) || 0, 
               cost: parseFloat(inputs[2].value) || 0 
             });
          }
       });

       const labor = [];
       block.querySelectorAll('.lab-body tr').forEach(tr => {
          const inputs = tr.querySelectorAll('input');
          if (inputs[0].value) { // If workforce type exists
             labor.push({ 
               workforce: inputs[0].value, 
               quantity: parseInt(inputs[1].value) || 0, 
               cost: parseFloat(inputs[2].value) || 0 
             });
          }
       });

       cpiSchedule.push({ daysAfterPlanting: dap, materials, labor });
    });

    // 4. Construct the exact JSON Payload the backend expects
    const formData = {
      // Personal Info
      proposerName: document.getElementById('proposerName').value,
      address: document.getElementById('address').value,
      birthday: document.getElementById('birthday').value,
      contactNo: contacts[0] || '',
      secondaryContactNo: contacts[1] || null,
      civilStatus: document.getElementById('civilStatus').value,
      sex: document.getElementById('sex').value,
      beneficiary: document.getElementById('beneficiary').value,
      spouse: document.getElementById('spouse').value || null,
      spouseBirthday: document.getElementById('spouseBday').value || null,
      isIP: document.getElementById('ipToggle').checked,
      tribe: document.getElementById('tribe').value || null,

      // Farm Info
      plantationName: document.getElementById('plantationName').value,
      farmAddress: document.getElementById('farmAddress').value,
      farmArea: parseFloat(document.getElementById('farmArea').value) || 0,
      soilType: document.getElementById('soilType').value,
      soilPH: parseFloat(document.getElementById('soilPH').value) || 0,
      topography: document.getElementById('topography').value,
      irrigationType: document.getElementById('irrigationType').value,

      // Insurance Info
      crops: document.getElementById('crops').value,
      plantationSize: parseFloat(document.getElementById('plantationSize').value) || 0,
      coverageStart: document.getElementById('coverageStart').value,
      coverageEnd: document.getElementById('coverageEnd').value,
      desiredAmountCover: parseFloat(document.getElementById('desiredCover').value) || 0,
      supervisingPT: document.getElementById('supervisingPT').value,
      ptDate: document.getElementById('ptDate').value,
      proposerDate: document.getElementById('proposeDate').value,

      // Perils
      perils: {
        flood: document.getElementById('perilFlood')?.checked || false,
        typhoon: document.getElementById('perilTyphoon').checked,
        drought: document.getElementById('perilDrought').checked,
        pests: document.getElementById('perilPest').checked
      },

      // Varieties Array
      varieties: (function() {
        const arr = [{
          varietyName: document.getElementById('variety').value,
          areaPlanted: parseFloat(document.getElementById('areaPlanted').value) || 0,
          datePlanting: document.getElementById('datePlanting').value,
          estHarvestDate: document.getElementById('estHarvest').value,
          ageGroup: document.getElementById('ageGroup').textContent.split(': ')[1] || null,
          numTrees: parseInt(document.getElementById('treesNum')?.value) || parseInt(document.getElementById('hillsNum')?.value) || 0,
          avgYield: parseFloat(document.getElementById('avgYield').value) || 0
        }];
        
        const block2 = document.getElementById('varietyBlock2');
        if (block2 && !block2.classList.contains('hidden')) {
          arr.push({
            varietyName: document.getElementById('variety2').value,
            areaPlanted: parseFloat(document.getElementById('areaPlanted2').value) || 0,
            datePlanting: document.getElementById('datePlanting2').value,
            estHarvestDate: document.getElementById('estHarvest2').value,
            ageGroup: document.getElementById('ageGroup2').textContent.split(': ')[1] || null,
            numTrees: parseInt(document.getElementById('treesNum2')?.value) || parseInt(document.getElementById('hillsNum2')?.value) || 0,
            avgYield: parseFloat(document.getElementById('avgYield2')?.value) || 0
          });
        }
        return arr;
      })(),
      
      // CPI Array
      cpiSchedule: cpiSchedule
    };

    // 5. Send data to  Node.js Backend
    fetch('http://localhost:3000/api/submit-insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.generatedInsuranceID) {
            // SUCCESS UI UPDATE
            document.getElementById(`page-${cur}`).classList.remove('active');
            document.getElementById('page-success').classList.add('active');
            document.getElementById('formFooter').style.display = 'none';
            updatePills(TOTAL);
            
            document.getElementById('stepLabel').textContent = 'Application Submitted';
            document.getElementById('stepCounter').textContent = 'Complete';
            document.getElementById('progressFill').style.width = '100%';
            
            // Inject the beautiful sequential ID into the UI
            document.getElementById('refNumber').textContent = data.generatedInsuranceID;
            showToast('Application submitted successfully!', 'success');
        } else {
            // BACKEND REJECTED IT
            showToast('Error: ' + (data.error || 'Failed to save application.'));
            btnNext.innerHTML = originalText;
            btnNext.disabled = false;
        }
    })
    .catch(error => {
        // SERVER IS OFF OR CRASHED
        console.error("Fetch error:", error);
        showToast('Network error: Ensure backend server is running on port 3000.');
        btnNext.innerHTML = originalText;
        btnNext.disabled = false;
    });

    return; // Stop execution here so it waits for the fetch to finish
  }

  document.getElementById(`page-${cur}`).classList.remove('active');
  cur++;
  document.getElementById(`page-${cur}`).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep() {
  if (cur === 0) return;
  document.getElementById(`page-${cur}`).classList.remove('active');
  cur--;
  document.getElementById(`page-${cur}`).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncNav() {
  const btnBack = document.getElementById('btnBack');
  const btnNext = document.getElementById('btnNext');

  btnBack.style.visibility = cur === 0 ? 'hidden' : 'visible';

  if (cur === TOTAL - 1) {
    btnNext.innerHTML = '<i class="ti ti-send text-sm" aria-hidden="true"></i> Submit application';
    btnNext.style.background  = '#BA7517';
    btnNext.style.boxShadow   = '0 2px 8px rgba(186,117,23,0.3)';
  } else {
    btnNext.innerHTML = 'Next <i class="ti ti-arrow-right text-sm" aria-hidden="true"></i>';
    btnNext.style.background  = '#0F6E56';
    btnNext.style.boxShadow   = '0 2px 8px rgba(15,110,86,0.3)';
  }

  document.getElementById('stepLabel').textContent   = LABELS[cur];
  document.getElementById('stepCounter').textContent = `Step ${cur + 1} of ${TOTAL}`;
  document.getElementById('progressFill').style.width =
    `${((cur + 1) / TOTAL * 100).toFixed(2)}%`;

  updatePills(cur);
}

function updatePills(active) {
  document.querySelectorAll('.step-pill').forEach((p, i) => {
    p.classList.remove('active', 'done');
    p.setAttribute('aria-current', i === active ? 'step' : 'false');
    if (i === active) p.classList.add('active');
    else if (i < active) p.classList.add('done');
  });
}

function resetForm() {
  location.reload();
}


/* ══════════════════════════════════════════════════════════════
   TAG INPUT (multi-valued contact numbers)
══════════════════════════════════════════════════════════════ */

function addTag(e, wrapId) {
  if (e.key !== 'Enter') return;
  e.preventDefault();

  const wrap  = document.getElementById(wrapId);
  const input = wrap.querySelector('.tag-input');
  const val   = input.value.trim();
  if (!val) return;

  // 1. Count existing tags and block if there are already 2
  const existingTags = wrap.querySelectorAll('.tag');
  if (existingTags.length >= 2) {
    showToast('You can only add a maximum of 2 contact numbers.');
    input.value = ''; 
    return; 
  }

  // check for numbers only, and at least 7 digits
  if (val.length < 7 || !/^\d+$/.test(val)) {
    showToast('Please enter a valid phone number (digits only).');
    return;
  }

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.innerHTML = `${val} <button onclick="removeTag(this)" aria-label="Remove ${val}">×</button>`;
  wrap.insertBefore(tag, input);
  input.value = '';

  wrap.classList.remove('field-error');
}

// remove function
function removeTag(btn) {
  btn.parentElement.remove();
}

/* ══════════════════════════════════════════════════════════════
   IP / TRIBE TOGGLE
══════════════════════════════════════════════════════════════ */

function toggleTribe() {
  const isOn   = document.getElementById('ipToggle').checked;
  const field  = document.getElementById('tribeField');
  field.classList.toggle('hidden', !isOn);
  
  // Wipe the data if they turn the toggle off
  if (!isOn) {
    const tribeInput = document.getElementById('tribe');
    if (tribeInput) tribeInput.value = '';
  }
}

/* ══════════════════════════════════════════════════════════════
   AGE GROUP (Calculates duration from Planting to Harvest)
══════════════════════════════════════════════════════════════ */
function calcAge(suffix = '') {
  const dp = document.getElementById('datePlanting' + suffix)?.value;
  const dh = document.getElementById('estHarvest' + suffix)?.value;
  const el = document.getElementById('ageGroup' + suffix);
  
  if (!el) return;

  if (!dp) {
    el.textContent = 'Calculating from date of planting…';
    return;
  }

  const planted = new Date(dp);
  
  // Use the Harvest Date if they entered one. If not, fallback to today.
  const targetDate = dh ? new Date(dh) : new Date();

  // If planting date is somehow after the target date, return zero.
  if (planted > targetDate) {
    el.textContent = '0 years, 0 months — Age group: 0.00';
    return;
  }

  let yrs = targetDate.getFullYear() - planted.getFullYear();
  let mos = targetDate.getMonth() - planted.getMonth();

  // If the specific day of the month hasn't been reached yet, subtract 1 month
  if (targetDate.getDate() < planted.getDate()) {
    mos--;
  }

  // If months dip below zero, borrow 1 year and add 12 months
  if (mos < 0) {
    yrs--;
    mos += 12;
  }

  // Calculate exact decimal age (e.g., 3 months / 12 = 0.25)
  let decimalAge = (yrs + (mos / 12)).toFixed(2);

  // Build the readable label
  let label = `${yrs} year${yrs !== 1 ? 's' : ''}`;
  label += `, ${mos} month${mos !== 1 ? 's' : ''}`;
  label += ` — Age group: ${decimalAge}`;

  el.textContent = label;
}
/* ══════════════════════════════════════════════════════════════
   CPI — Dynamic blocks
══════════════════════════════════════════════════════════════ */

function buildCPIBlock(isFirst) {
  const removeBtn = isFirst ? '' : `
    <button class="del-block-btn" onclick="removeCPIBlock(this)">
      <i class="ti ti-trash text-sm" aria-hidden="true"></i> Remove schedule
    </button>`;

  const matRow = () => `
    <tr class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Item name" aria-label="Item name" /></td>
      <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" aria-label="Quantity" /></td>
      <td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" aria-label="Cost" oninput="recalcTotal()" /></td>
      <td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete row"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
    </tr>`;

  const labRow = () => `
    <tr class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Workforce type" aria-label="Workforce type" /></td>
      <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" aria-label="Quantity" /></td>
      <td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" aria-label="Cost" oninput="recalcTotal()" /></td>
      <td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete row"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
    </tr>`;

  const tableHead = (col1Label) => `
    <thead>
      <tr class="bg-gray-50 border-b border-gray-200">
        <th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:42%">${col1Label}</th>
        <th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:26%">Quantity</th>
        <th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:22%">Cost (₱)</th>
        <th style="width:10%"></th>
      </tr>
    </thead>`;

  const block = document.createElement('div');
  block.className = 'cpi-block';

  block.innerHTML = `
    <div class="cpi-block-header">
      <div class="flex flex-col gap-1" style="max-width:200px; margin-bottom:14px;">
        <label class="text-xs font-medium text-gray-600">
          Days after planting <span class="text-red-500">*</span>
        </label>
        <input type="number" class="dap-input field-input" placeholder="0" maxlength="5" aria-label="Days after planting" />
        <p class="text-[11px] text-gray-400">Integer (5 chars)</p>
      </div>
      ${removeBtn}
    </div>

    <p class="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2">
      <i class="ti ti-package text-green-500 text-sm" aria-hidden="true"></i> Materials
    </p>
    <div class="border border-gray-200 rounded-xl overflow-hidden mb-2">
      <table class="cpi-tbl w-full text-sm">
        ${tableHead('Item')}
        <tbody class="mat-body">${matRow()}</tbody>
      </table>
    </div>
    <button class="add-row" onclick="addMatRow(this)">
      <i class="ti ti-plus" aria-hidden="true"></i> Add material entry
    </button>

    <p class="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2 mt-5">
      <i class="ti ti-users text-green-500 text-sm" aria-hidden="true"></i> Labor
    </p>
    <div class="border border-gray-200 rounded-xl overflow-hidden mb-2">
      <table class="cpi-tbl w-full text-sm">
        ${tableHead('Workforce')}
        <tbody class="lab-body">${labRow()}</tbody>
      </table>
    </div>
    <button class="add-row" onclick="addLabRow(this)">
      <i class="ti ti-plus" aria-hidden="true"></i> Add labor entry
    </button>

    <hr class="block-divider" />
  `;

  return block;
}

function addCPIBlock() {
  document.getElementById('cpiBlocksContainer').appendChild(buildCPIBlock(false));
}

function removeCPIBlock(btn) {
  btn.closest('.cpi-block').remove();
  recalcTotal();
}

/* ── Row management ── */
function removeRow(btn) {
  btn.closest('tr').remove();
  recalcTotal();
}

function addMatRow(btn) {
  const tbody = btn.closest('.cpi-block').querySelector('.mat-body');
  const tr = document.createElement('tr');
  tr.className = 'border-b border-gray-100';
  tr.innerHTML = `
    <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Item name" aria-label="Item name" /></td>
    <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" aria-label="Quantity" /></td>
    <td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" aria-label="Cost" oninput="recalcTotal()" /></td>
    <td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete row"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
  `;
  tbody.appendChild(tr);
}

function addLabRow(btn) {
  const tbody = btn.closest('.cpi-block').querySelector('.lab-body');
  const tr = document.createElement('tr');
  tr.className = 'border-b border-gray-100';
  tr.innerHTML = `
    <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Workforce type" aria-label="Workforce type" /></td>
    <td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" aria-label="Quantity" /></td>
    <td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" aria-label="Cost" oninput="recalcTotal()" /></td>
    <td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete row"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
  `;
  tbody.appendChild(tr);
}

/* ── Grand total (derived) ── */
function recalcTotal() {
  let total = 0;
  document.querySelectorAll('.cost-input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  document.getElementById('totalCost').textContent =
    '₱' + total.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

/* ══════════════════════════════════════════════════════════════
DARK MODE
══════════════════════════════════════════════════════════════ */

function toggleTheme() {
  const htmlEl = document.documentElement;
  const themeIcon = document.querySelector('#themeToggle i');
  const isDark = htmlEl.getAttribute('data-theme') === 'dark';

  if (isDark) {
    htmlEl.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    if (themeIcon) themeIcon.className = 'ti ti-moon text-lg';
  } else {
    htmlEl.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    if (themeIcon) themeIcon.className = 'ti ti-sun text-lg';
  }
}

// Check saved theme on page load
window.addEventListener('DOMContentLoaded', () => {
  let saved;
  try { saved = localStorage.getItem('theme'); } catch (_) {}
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const themeIcon = document.querySelector('#themeToggle i');
    if (themeIcon) themeIcon.className = 'ti ti-sun text-lg';
  }

  const civilStatusDropdown = document.getElementById('civilStatus');
    if (civilStatusDropdown) {
    civilStatusDropdown.addEventListener('change', toggleSpouse);
    toggleSpouse(); // Run once on load to lock it by default
  }

  /* 4. Apply DB-level field constraints (maxlength / min / max) */
  FIELD_CONSTRAINTS.forEach(({ id, maxlength, min, max }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (maxlength !== undefined) el.setAttribute('maxlength', maxlength);
    if (min       !== undefined) el.setAttribute('min', min);
    if (max       !== undefined) el.setAttribute('max', max);
  });

  /* 5. Attach live error-clearing to all required fields */
  Object.values(REQUIRED).flat().forEach(id => {
    const el = document.getElementById(id);
    if (el) clearErrorOnInput(el);
  });

  /* 6. Set default date for proposer date (today) */
  const proposeDate = document.getElementById('proposeDate');
  if (proposeDate && !proposeDate.value) {
    proposeDate.value = new Date().toISOString().split('T')[0];
  }

});

 /* Disable Spouse if Single is selected */
function toggleSpouse() {
  const dropdown = document.getElementById('civilStatus');
  const spouseName = document.getElementById('spouse');
  const spouseBday = document.getElementById('spouseBday');
  
  if (!dropdown || !spouseName || !spouseBday) return;

  const statusValue = dropdown.value.toLowerCase().trim();
  const statusText = dropdown.options[dropdown.selectedIndex].text.toLowerCase().trim();

  if (statusValue === 'married' || statusText === 'married') {
    spouseName.disabled = false;
    spouseBday.disabled = false;
    spouseName.removeAttribute('readonly');
    spouseBday.removeAttribute('readonly');
    
    spouseName.classList.remove('opacity-50', 'bg-gray-100', 'cursor-not-allowed');
    spouseBday.classList.remove('opacity-50', 'bg-gray-100', 'cursor-not-allowed');
  } else {
    spouseName.disabled = true;
    spouseBday.disabled = true;
    spouseName.value = '';
    spouseBday.value = '';
    
    spouseName.classList.remove('field-error');
    spouseBday.classList.remove('field-error');
    
    spouseName.classList.add('opacity-50', 'bg-gray-100', 'cursor-not-allowed');
    spouseBday.classList.add('opacity-50', 'bg-gray-100', 'cursor-not-allowed');
  }
}

/* ══════════════════════════════════════════════════════════════
   SECOND VARIETY TOGGLE
══════════════════════════════════════════════════════════════ */
function toggleVariety2(show) {
  const block2 = document.getElementById('varietyBlock2');
  const addBtn = document.getElementById('addVarietyBtn');
  
  if (show) {
    block2.classList.remove('hidden');
    addBtn.classList.add('hidden');
  } else {
    block2.classList.add('hidden');
    addBtn.classList.remove('hidden');
    
    // Clear out the data if they change their mind and remove it
    document.getElementById('variety2').value = '';
    document.getElementById('areaPlanted2').value = '';
    document.getElementById('datePlanting2').value = '';
    document.getElementById('estHarvest2').value = '';
    
    // Clear error highlights just in case
    document.querySelectorAll('#varietyBlock2 .field-error').forEach(el => {
      el.classList.remove('field-error');
    });
  }
}