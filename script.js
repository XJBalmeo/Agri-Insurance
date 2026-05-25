/* ── State ── */
let cur = 0;
let maxVisited = 0;
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
  { id: 'soilType',       maxlength: 10  },
  { id: 'topography',     maxlength: 10  },
  { id: 'variety',        maxlength: 20  },
  { id: 'irrigationType', maxlength: 15  },
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
  // Clear previous error highlights
  document.querySelectorAll('.field-error').forEach(el => {
    el.classList.remove('field-error');
  });

  let valid = true;
  const requiredIds = REQUIRED[step] ?? [];

  requiredIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isEmpty = el.value.trim() === '';
    if (isEmpty) {
      el.classList.add('field-error');
      valid = false;
    }
  });

  // Step 1 — at least one peril must be checked
  if (step === 1) {
    const perilChecked = ['perilDrought', 'perilTyphoon', 'perilPest']
      .some(id => document.getElementById(id)?.checked);
    if (!perilChecked) {
      // Highlight the perils container
      const perilSection = document.querySelector('#page-1 .custom-checkbox-label');
      perilSection?.closest('div')?.classList.add('field-error');
      valid = false;
    }
  }

  // Step 4 — at least one CPI block must have a DAP value filled
  if (step === 4) {
    const dapInputs = [...document.querySelectorAll('.dap-input')];
    const anyFilled = dapInputs.some(i => i.value.trim() !== '');
    if (!anyFilled) {
      dapInputs.forEach(i => i.classList.add('field-error'));
      valid = false;
    }
  }

  // Step 0 — contact numbers: at least one tag must be added
  if (step === 0) {
    const tags = document.querySelectorAll('#contactWrap .tag');
    if (tags.length === 0) {
      document.getElementById('contactWrap')?.classList.add('field-error');
      valid = false;
    }
  }

  if (!valid) {
    showToast('Please fill in all required fields before continuing.');
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
  if (n > cur) return;
  document.getElementById('page-' + cur).classList.remove('active');
  cur = n;
  document.getElementById(`page-${cur}`).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(stepEl) {
  const required = stepEl.querySelectorAll('.field-input[required]');
  let valid = true;
  required.forEach(el => {
    if (!el.value.trim()) {
      el.classList.add('field-error');
      valid = false;
    } else {
      el.classList.remove('field-error');
    }
  });
  return valid;
}

function nextStep() {
  if (cur === TOTAL - 1) {
    // Final submit
    document.getElementById(`page-${cur}`).classList.remove('active');
    document.getElementById('page-success').classList.add('active');
    document.getElementById('formFooter').style.display = 'none';
    updatePills(TOTAL);
    document.getElementById('stepLabel').textContent  = 'Application Submitted';
    document.getElementById('stepCounter').textContent = 'Complete';
    document.getElementById('progressFill').style.width = '100%';
    return;
  }

  document.getElementById(`page-${cur}`).classList.remove('active');
  cur++;
  document.getElementById('page-' + cur).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  focusStepHeading(cur);
}

function prevStep() {
  if (cur === 0) return;
  document.getElementById(`page-${cur}`).classList.remove('active');
  cur--;
  document.getElementById(`page-${cur}`).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  focusStepHeading(cur);
}

function focusStepHeading(n) {
  var heading = document.querySelector('#page-' + n + ' h3, #page-' + n + ' h2');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus();
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

/* ── Tag input (multi-valued fields) ── */
function addTag(e, wrapId) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  var wrap  = document.getElementById(wrapId);
  var input = wrap.querySelector('.tag-input');
  var val   = input.value.trim();
  if (!val) return;

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.innerHTML = val + ' <button onclick="removeTag(this)" aria-label="Remove">×</button>';
  wrap.insertBefore(tag, input);
  input.value = '';
}

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
}

/* ══════════════════════════════════════════════════════════════
   AGE GROUP (derived from date of planting)
══════════════════════════════════════════════════════════════ */

function calcAge() {
  const dp = document.getElementById('datePlanting')?.value;
  const el = document.getElementById('ageGroup');
  if (!el) return;

  if (!dp) {
    el.textContent = 'Calculating from date of planting…';
    return;
  }

  const planted = new Date(dp);
  const now     = new Date();
  let yrs = now.getFullYear() - planted.getFullYear();
  let mos = now.getMonth()    - planted.getMonth();

  if (mos < 0) { yrs--; mos += 12; }

  let label = `${yrs} year${yrs !== 1 ? 's' : ''}`;
  if (mos) label += `, ${mos} month${mos !== 1 ? 's' : ''}`;
  label += ` — Age group: ${yrs}`;

  el.textContent = label;
}

/* ══════════════════════════════════════════════════════════════
   CPI — Dynamic blocks
══════════════════════════════════════════════════════════════ */

/**
 * Builds a full CPI schedule block using a template literal.
 * Much safer and more readable than string concatenation.
 */
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

  block.innerHTML =
    '<div class="cpi-block-header">' +
      '<div class="flex flex-col gap-1" style="max-width:200px; margin-bottom:14px;">' +
        '<label class="text-xs font-medium text-gray-600">Days after planting <span class="text-red-500">*</span></label>' +
        '<input type="number" class="dap-input field-input" placeholder="0" />' +
        '<p class="text-[11px] text-gray-400">Integer (5 chars)</p>' +
      '</div>' +
      (isFirst ? '' :
        '<button class="del-block-btn" onclick="removeCPIBlock(this)">' +
          '<i class="ti ti-trash text-sm" aria-hidden="true"></i> Remove schedule' +
        '</button>'
      ) +
    '</div>' +

    '<p class="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2">' +
      '<i class="ti ti-package text-green-500 text-sm" aria-hidden="true"></i> Materials' +
    '</p>' +
    '<div class="border border-gray-200 rounded-xl overflow-hidden mb-2">' +
      '<table class="cpi-tbl w-full text-sm">' +
        '<thead><tr class="bg-gray-50 border-b border-gray-200">' +
          '<th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:42%">Item</th>' +
          '<th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:26%">Quantity</th>' +
          '<th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:22%">Cost (₱)</th>' +
          '<th style="width:10%"></th>' +
        '</tr></thead>' +
        '<tbody class="mat-body">' +
          '<tr class="border-b border-gray-100">' +
            '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Item name" /></td>' +
            '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" /></td>' +
            '<td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" oninput="recalcTotal()" /></td>' +
            '<td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' +
          '</tr>' +
        '</tbody>' +
      '</table>' +
    '</div>' +
    '<button class="add-row" onclick="addMatRow(this)">' +
      '<i class="ti ti-plus" aria-hidden="true"></i> Add material entry' +
    '</button>' +

    '<p class="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2 mt-5">' +
      '<i class="ti ti-users text-green-500 text-sm" aria-hidden="true"></i> Labor' +
    '</p>' +
    '<div class="border border-gray-200 rounded-xl overflow-hidden mb-2">' +
      '<table class="cpi-tbl w-full text-sm">' +
        '<thead><tr class="bg-gray-50 border-b border-gray-200">' +
          '<th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:42%">Workforce</th>' +
          '<th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:26%">Quantity</th>' +
          '<th class="text-left px-3 py-2 text-[11px] font-medium text-gray-400" style="width:22%">Cost (₱)</th>' +
          '<th style="width:10%"></th>' +
        '</tr></thead>' +
        '<tbody class="lab-body">' +
          '<tr class="border-b border-gray-100">' +
            '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Workforce type" /></td>' +
            '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" /></td>' +
            '<td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" oninput="recalcTotal()" /></td>' +
            '<td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash" aria-hidden="true"></i></button></td>' +
          '</tr>' +
        '</tbody>' +
      '</table>' +
    '</div>' +
    '<button class="add-row" onclick="addLabRow(this)">' +
      '<i class="ti ti-plus" aria-hidden="true"></i> Add labor entry' +
    '</button>' +

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
  tr.innerHTML =
    '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Item name" /></td>' +
    '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" /></td>' +
    '<td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" oninput="recalcTotal()" /></td>' +
    '<td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash" aria-hidden="true"></i></button></td>';
  tbody.appendChild(tr);
}

function addLabRow(btn) {
  const tbody = btn.closest('.cpi-block').querySelector('.lab-body');
  const tr = document.createElement('tr');
  tr.className = 'border-b border-gray-100';
  tr.innerHTML =
    '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Workforce type" /></td>' +
    '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" /></td>' +
    '<td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" oninput="recalcTotal()" /></td>' +
    '<td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash" aria-hidden="true"></i></button></td>';
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
  
  if (htmlEl.getAttribute('data-theme') === 'dark') {
    // Switch to Light Mode
    htmlEl.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeIcon.className = 'ti ti-moon';
  } else {
    // Switch to Dark Mode
    htmlEl.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeIcon.className = 'ti ti-sun';
  }
}

// Check saved theme on page load
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const themeIcon = document.querySelector('#themeToggle i');
    if (themeIcon) themeIcon.className = 'ti ti-sun';
  }

});