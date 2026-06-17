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
    'irrigationType', 'treesNum', 'avgYield',
  ],
  4: [], // CPI has its own check below
  5: ['supervisingPT', 'ptDate', 'proposeDate'],
};

/* ── Field constraints (maxlength / max / min) ───────────────── */
// Applied on DOMContentLoaded so the Data Dictionary column sizes are
// enforced in-browser. Keep these in sync with schema.sql / validators.js.
const FIELD_CONSTRAINTS = [
  // Text fields — maxlength = VARCHAR/CHAR size in the data dictionary.
  { id: 'proposerName',   maxlength: 30  },
  { id: 'address',        maxlength: 100 },
  { id: 'beneficiary',    maxlength: 30  },
  { id: 'spouse',         maxlength: 30  },
  { id: 'tribe',          maxlength: 20  },
  { id: 'plantationName', maxlength: 20  },
  { id: 'farmAddress',    maxlength: 100 },
  { id: 'crops',          maxlength: 20  },
  { id: 'soilType',       maxlength: 20  },
  { id: 'topography',     maxlength: 20  },
  { id: 'irrigationType', maxlength: 20  },
  { id: 'variety',        maxlength: 20  },
  { id: 'variety2',       maxlength: 20  },
  { id: 'supervisingPT',  maxlength: 30  },
  // Numeric fields — max = the data dictionary "size" ceiling (advisory;
  // the backend is the real gate, since this form uses custom JS validation).
  { id: 'soilPH',         min: 0.1, max: 14.9 },
  { id: 'farmArea',       min: 0.01, max: 999.99 },
  { id: 'plantationSize', min: 0.01, max: 999.99 },
  { id: 'areaPlanted',    min: 0.01, max: 999.99 },
  { id: 'areaPlanted2',   min: 0.01, max: 999.99 },
  { id: 'avgYield',       min: 0.1,  max: 9999.9 },
  { id: 'avgYield2',      min: 0.1,  max: 9999.9 },
  { id: 'treesNum',       min: 1, max: 99999 },
  { id: 'treesNum2',      min: 1, max: 99999 },
  // desiredCover: DECIMAL(10,2); it's a type="text" currency field, so `max`
  // can't apply here — the backend enforces the 99,999,999.99 ceiling.
];

/* ══════════════════════════════════════════════════════════════
   DATE HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Returns today's date as a "YYYY-MM-DD" string in the user's LOCAL timezone.
 *
 * Why not `new Date().toISOString().split('T')[0]`? toISOString() always
 * formats in UTC. For the Philippines (UTC+8), during local evening/night
 * the UTC date is still "yesterday", so that approach would lock the form to
 * the wrong day. Reading getFullYear/getMonth/getDate gives the LOCAL parts,
 * which always match the user's wall clock.
 */
function todayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-based
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

  clearFieldErrors();   // wipe highlights + messages from a previous attempt

  let valid = true;
  const requiredIds = REQUIRED[step] ?? [];

  // Check all basic required fields
  requiredIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.value.trim() === '') {
      showFieldError(el, 'This field is required.');
      valid = false;
    }
  });

  // Step 0 — Contact numbers: at least one tag must be added
  if (step === 0) {
    const tags = document.querySelectorAll('#contactWrap .tag');
    if (tags.length === 0) {
      showFieldError(document.getElementById('contactWrap'), 'Add at least one contact number.');
      valid = false;
    }
  }

  // Step 1 — Perils & Coverage Dates
  if (step === 1) {
    // 1. Check Perils — at least one must be ticked
    const perilChecked = ['perilFlood', 'perilDrought', 'perilTyphoon', 'perilPest']
      .some(id => document.getElementById(id)?.checked);
    if (!perilChecked) {
      showFieldError(document.getElementById('perilsGroup'), 'Select at least one peril to be covered.');
      valid = false;
    }

    // 2. Check Chronological Dates
    const start = document.getElementById('coverageStart')?.value;
    const end = document.getElementById('coverageEnd')?.value;
    if (start && end && new Date(start) >= new Date(end)) {
      showFieldError(document.getElementById('coverageEnd'), 'Coverage end date must be after the start date.');
      valid = false;
    }

    // Coverage can't start in the past. The picker's min blocks this in the
    // UI; re-check here so a typed/tampered value can't slip past. String
    // compare is safe because YYYY-MM-DD sorts chronologically.
    const today = todayLocal();
    if (start && start < today) {
      showFieldError(document.getElementById('coverageStart'), 'Coverage start date cannot be in the past.');
      valid = false;
    }
  }

  // Step 3 — Validate Planting vs Harvest Dates
  if (step === 3) {
    // Check Variety 1 Dates
    const planted1 = document.getElementById('datePlanting')?.value;
    const harvest1 = document.getElementById('estHarvest')?.value;
    if (planted1 && harvest1 && new Date(planted1) >= new Date(harvest1)) {
      showFieldError(document.getElementById('estHarvest'), 'Harvest date must be after the planting date.');
      valid = false;
    }

    // Check Variety 2 (ONLY if it is currently visible)
    const block2 = document.getElementById('varietyBlock2');
    if (block2 && !block2.classList.contains('hidden')) {
      const requiredBlock2 = [
        'variety2', 'areaPlanted2', 'datePlanting2', 'estHarvest2',
        'treesNum2', 'avgYield2',
      ];

      requiredBlock2.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value.trim() === '') {
          showFieldError(el, 'This field is required.');
          valid = false;
        }
      });

      // Check Variety 2 Dates
      const planted2 = document.getElementById('datePlanting2')?.value;
      const harvest2 = document.getElementById('estHarvest2')?.value;
      if (planted2 && harvest2 && new Date(planted2) >= new Date(harvest2)) {
        showFieldError(document.getElementById('estHarvest2'), 'Harvest date must be after the planting date.');
        valid = false;
      }
    }
  }

  // Step 4 — CPI Blocks (Must have DAP & No Duplicates)
  if (step === 4) {
    const dapInputs = [...document.querySelectorAll('.dap-input')];
    const dapValues = dapInputs.map(i => i.value.trim());

    // Every schedule must carry a Days-After-Planting value. A blank field is
    // "missing", not day 0 — flag each empty one so it can't slip through as 0.
    const emptyInputs = dapInputs.filter(i => i.value.trim() === '');
    if (emptyInputs.length > 0) {
      emptyInputs.forEach(i => i.classList.add('field-error'));
      showToast('Every schedule needs a Days-After-Planting value (use 0 for planting day).');
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

  // Summary toast — fires once if anything failed and no specific toast is up.
  if (!valid && !document.getElementById('pcic-toast')) {
    showToast('Please fix the highlighted fields before continuing.');
  }

  // Move focus to the first field with an error so keyboard/screen-reader
  // users are taken straight to what needs fixing.
  if (!valid) {
    const firstBad = document.querySelector('.field-error');
    if (firstBad && typeof firstBad.focus === 'function') firstBad.focus({ preventScroll: false });
  }

  return valid;
}


/* ── Inline field errors ──────────────────────────────────────────
   Each errored control gets a red outline plus a message element placed
   right after it, linked via aria-describedby so screen readers announce
   the reason. Messages are reused (id = "<fieldId>-err") so we never stack
   duplicates across repeated validation attempts. */
function showFieldError(el, msg) {
  if (!el) return;
  el.classList.add('field-error');
  if (!el.id) return;   // no id (e.g. raw CPI inputs) — highlight only

  let m = document.getElementById(el.id + '-err');
  if (!m) {
    m = document.createElement('p');
    m.id = el.id + '-err';
    m.className = 'field-msg';
    el.insertAdjacentElement('afterend', m);
    const described = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    described.push(m.id);
    el.setAttribute('aria-describedby', described.join(' '));
  }
  m.textContent = msg;
  m.style.display = 'block';
}

function hideFieldError(el) {
  if (!el) return;
  el.classList.remove('field-error');
  const m = el.id && document.getElementById(el.id + '-err');
  if (m) m.style.display = 'none';
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-msg').forEach(m => { m.style.display = 'none'; });
}


/* ── Clear an error the moment the user starts fixing the field ── */
function clearErrorOnInput(el) {
  const clear = () => hideFieldError(el);
  el.addEventListener('input',  clear);
  el.addEventListener('change', clear);
}

/* ── Live numeric validation (fires on blur) ────────────────────
   Flags a number that's non-numeric, negative, or outside the
   field's min/max as soon as focus leaves it — instead of waiting
   for "Next". Empty fields are left alone: "required" is still
   enforced by validateStep() when the user advances. */
function validateNumberField(el) {
  if (!el) return;
  const raw = el.value.trim();
  if (raw === '') { hideFieldError(el); return; }   // empty → caught on Next

  // Currency fields carry "₱"/commas, so parse them; plain number
  // inputs can be read straight from the value.
  const isCurrency = el.classList.contains('currency-input');
  const num = isCurrency ? parseCurrency(el.value) : parseFloat(raw);

  // min/max were set on the elements from FIELD_CONSTRAINTS; fall back
  // to "0 or more" for fields (like the peso inputs) with no attributes.
  const min = el.min !== '' ? parseFloat(el.min) : 0;
  const max = el.max !== '' ? parseFloat(el.max) : Infinity;

  if (Number.isNaN(num) || num < min || num > max) {
    const range = max === Infinity ? `${min} or more` : `between ${min} and ${max}`;
    showFieldError(el, `Enter a number ${range}.`);
  } else {
    hideFieldError(el);
  }
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

/* ── Maintenance banner (server or database unreachable) ──────── */
// Toggle both classes so the banner's display state never depends on
// which Tailwind utility happens to win in the stylesheet.
function showMaintenanceNotice() {
  const notice = document.getElementById('maintenanceNotice');
  notice?.classList.remove('hidden');
  notice?.classList.add('flex');
}

function hideMaintenanceNotice() {
  const notice = document.getElementById('maintenanceNotice');
  notice?.classList.add('hidden');
  notice?.classList.remove('flex');
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

  // Final step submits instead of advancing.
  if (cur === TOTAL - 1) {
    submitApplication();
    return;
  }

  document.getElementById(`page-${cur}`).classList.remove('active');
  cur++;
  document.getElementById(`page-${cur}`).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Read the whole form into the JSON payload the backend expects ── */
function collectFormData() {
  // Contact chips → [primary, secondary]
  const contacts = Array.from(document.querySelectorAll('#contactWrap .tag'))
    .map(t => t.textContent.replace('×', '').trim());

  // CPI schedules. readRows() handles both the materials and labor tables —
  // they differ only in the name of the first column's key.
  const cpiSchedule = [];
  document.querySelectorAll('.cpi-block').forEach(block => {
    const readRows = (sel, nameKey) => {
      const rows = [];
      block.querySelectorAll(sel + ' tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input');
        if (inputs[0].value) {   // only rows where the name is filled in
          rows.push({
            [nameKey]: inputs[0].value,
            quantity: parseInt(inputs[1].value) || 0,
            cost: parseCurrency(inputs[2].value),
          });
        }
      });
      return rows;
    };
    // Keep a blank distinct from 0: send '' so the backend rejects a missing
    // value instead of silently treating it as "planting day" (0).
    const dapRaw = block.querySelector('.dap-input').value.trim();
    cpiSchedule.push({
      daysAfterPlanting: dapRaw === '' ? '' : parseInt(dapRaw, 10),
      materials: readRows('.mat-body', 'item'),
      labor: readRows('.lab-body', 'workforce'),
    });
  });

  // One builder for both variety blocks ('' = first, '2' = second).
  const variety = (s) => ({
    varietyName: document.getElementById('variety' + s).value,
    areaPlanted: parseFloat(document.getElementById('areaPlanted' + s).value) || 0,
    datePlanting: document.getElementById('datePlanting' + s).value,
    estHarvestDate: document.getElementById('estHarvest' + s).value,
    // Derived value read from the data attribute calcAge() writes (not scraped
    // from the display text, which can change formatting).
    ageGroup: document.getElementById('ageGroup' + s).dataset.ageGroup || null,
    numTrees: parseInt(document.getElementById('treesNum' + s)?.value) || 0,
    avgYield: parseFloat(document.getElementById('avgYield' + s)?.value) || 0,
  });

  const varieties = [variety('')];
  const block2 = document.getElementById('varietyBlock2');
  if (block2 && !block2.classList.contains('hidden')) varieties.push(variety('2'));

  return {
    // Personal info
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

    // Farm info
    plantationName: document.getElementById('plantationName').value,
    farmAddress: document.getElementById('farmAddress').value,
    farmArea: parseFloat(document.getElementById('farmArea').value) || 0,
    soilType: document.getElementById('soilType').value,
    soilPH: parseFloat(document.getElementById('soilPH').value) || 0,
    topography: document.getElementById('topography').value,
    irrigationType: document.getElementById('irrigationType').value,

    // Insurance info
    crops: document.getElementById('crops').value,
    plantationSize: parseFloat(document.getElementById('plantationSize').value) || 0,
    coverageStart: document.getElementById('coverageStart').value,
    coverageEnd: document.getElementById('coverageEnd').value,
    desiredAmountCover: parseCurrency(document.getElementById('desiredCover').value),
    supervisingPT: document.getElementById('supervisingPT').value,
    ptDate: document.getElementById('ptDate').value,
    proposerDate: document.getElementById('proposeDate').value,

    perils: {
      flood: document.getElementById('perilFlood')?.checked || false,
      typhoon: document.getElementById('perilTyphoon').checked,
      drought: document.getElementById('perilDrought').checked,
      pests: document.getElementById('perilPest').checked,
    },

    varieties,
    cpiSchedule,
  };
}

/* ── Swap the form for the success screen ── */
function showSuccess(insuranceId) {
  document.getElementById(`page-${cur}`).classList.remove('active');
  document.getElementById('page-success').classList.add('active');
  document.getElementById('formFooter').style.display = 'none';
  updatePills(TOTAL);

  document.getElementById('stepLabel').textContent = 'Application Submitted';
  document.getElementById('stepCounter').textContent = 'Complete';
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('refNumber').textContent = insuranceId;

  clearDraft();   // saved server-side now — drop the local draft
  showToast('Application submitted successfully!', 'success');
}

/* ── POST the application and route the response ── */
function submitApplication() {
  const btnNext = document.getElementById('btnNext');
  const originalText = btnNext.innerHTML;
  btnNext.innerHTML = '<i class="ti ti-loader animate-spin text-sm"></i> Submitting...';
  btnNext.disabled = true;
  hideMaintenanceNotice();   // a retry starts with a clean slate

  const resetButton = () => { btnNext.innerHTML = originalText; btnNext.disabled = false; };

  // Track the HTTP status so we can tell validation errors (400) apart from
  // server/database failures (500/503) below.
  let httpStatus = 0;
  fetch('http://localhost:3000/api/submit-insurance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collectFormData()),
    signal: AbortSignal.timeout(10000),
  })
  .then(response => {
    httpStatus = response.status;
    // Error responses aren't always JSON — fall back to {} so a parse failure
    // can't mask the real problem.
    return response.json().catch(() => ({}));
  })
  .then(data => {
    if (data.generatedInsuranceID) {
      showSuccess(data.generatedInsuranceID);
    } else if (httpStatus === 400) {
      // Validation failures arrive as { error, details: [...] }; other 400s
      // (e.g. an active-policy rejection) carry only `error`.
      const message = Array.isArray(data.details) && data.details.length
        ? data.details.join(' ')
        : (data.error || 'Failed to save application.');
      showToast('Error: ' + message);
      resetButton();
    } else {
      // Server/database failure — not the user's fault, so show the banner.
      showMaintenanceNotice();
      resetButton();
    }
  })
  .catch(error => {
    // Server unreachable (TypeError) or request timed out (TimeoutError).
    console.error('Fetch error:', error);
    showMaintenanceNotice();
    resetButton();
  });
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
  if (cur === TOTAL - 1) renderReview();   // refresh the recap on the final step
  scheduleSave();   // persist the current step so a reload returns here
}

function updatePills(active) {
  document.querySelectorAll('.step-pill').forEach((p, i) => {
    p.classList.remove('active', 'done');
    p.setAttribute('aria-current', i === active ? 'step' : 'false');
    // Forward navigation is blocked (goTo only allows going back), so steps
    // ahead of the current one are genuinely not reachable — disable them
    // instead of letting them look clickable and then scold the user.
    p.disabled = i > active;
    if (i === active) p.classList.add('active');
    else if (i < active) p.classList.add('done');
  });
}

function resetForm() {
  clearDraft();        // a "New application" starts from a blank slate
  location.reload();
}


/* ══════════════════════════════════════════════════════════════
   TAG INPUT (multi-valued contact numbers)
══════════════════════════════════════════════════════════════ */

// Keyboard entry point: only reacts to Enter, then defers to doAddTag()
function addTag(e, wrapId) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  doAddTag(wrapId);
}

// Shared logic, also called directly by the "+" button's onclick
function doAddTag(wrapId) {
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

  hideFieldError(wrap);   // clears the "Add at least one contact number" message
  scheduleSave();
}

// remove function
function removeTag(btn) {
  btn.parentElement.remove();
  scheduleSave();
}

/* ══════════════════════════════════════════════════════════════
   EARLY ACTIVE-POLICY WARNING — once name + birthday are entered,
   ask the backend whether that farmer already has an active policy,
   so they learn on step 1 instead of after filling all six steps.
   Advisory only: the backend enforces the same rule at submission.
══════════════════════════════════════════════════════════════ */

async function checkActivePolicy() {
  const proposerName = document.getElementById('proposerName').value.trim();
  const birthday = document.getElementById('birthday').value;
  const statusEl = document.getElementById('lookupStatus');
  if (!statusEl || proposerName === '' || birthday === '') return; // wait until both are filled

  try {
    const response = await fetch('http://localhost:3000/api/proposer/active-policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposerName, birthday }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return;               // the check is a convenience — fail silently
    const data = await response.json();

    if (data.activePolicy) {
      statusEl.classList.remove('hidden');
      statusEl.classList.add('text-amber-600');
      statusEl.textContent =
        `⚠ You have an active policy (${data.activePolicy.insuranceId}) until ${data.activePolicy.coverageEnd}. ` +
        'A new application cannot be submitted until it ends.';
    } else {
      // No active policy (or the name was edited to someone else): hide
      // any earlier warning so it can't mislead.
      statusEl.classList.add('hidden');
      statusEl.textContent = '';
    }
  } catch (error) {
    console.error('Active-policy check failed:', error);  // form stays fully usable
  }
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
    el.dataset.ageGroup = '';   // no value to submit yet
    return;
  }

  const planted = new Date(dp);
  
  // Use the Harvest Date if they entered one. If not, fallback to today.
  const targetDate = dh ? new Date(dh) : new Date();

  // If planting date is somehow after the target date, return zero.
  if (planted > targetDate) {
    el.textContent = '0 years, 0 months — Age group: 0.00';
    el.dataset.ageGroup = '0.00';
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
  el.dataset.ageGroup = decimalAge;   // the value collectFormData() submits
}
/* ══════════════════════════════════════════════════════════════
   CPI — Dynamic blocks
══════════════════════════════════════════════════════════════ */

/* One CPI table row. Materials and labor rows share the same shape — only
   the first column's placeholder/label differ — so the markup lives here and
   is reused by buildCPIBlock(), addMatRow() and addLabRow(). */
function cpiRowHTML(firstCol) {
  return `
    <tr class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="cpi-input" type="text" maxlength="30" placeholder="${firstCol}" aria-label="${firstCol}" /></td>
      <td class="px-3 py-2"><input class="cpi-input" type="number" min="1" placeholder="0" aria-label="Quantity" /></td>
      <td class="px-3 py-2"><input class="cpi-input cost-input currency-input" type="text" inputmode="decimal" placeholder="0.00" aria-label="Cost" oninput="recalcTotal()" /></td>
      <td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete row"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
    </tr>`;
}

function buildCPIBlock(isFirst) {
  const removeBtn = isFirst ? '' : `
    <button class="del-block-btn" onclick="removeCPIBlock(this)">
      <i class="ti ti-trash text-sm" aria-hidden="true"></i> Remove schedule
    </button>`;

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
        <tbody class="mat-body">${cpiRowHTML('Item name')}</tbody>
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
        <tbody class="lab-body">${cpiRowHTML('Workforce type')}</tbody>
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
  scheduleSave();
}

function removeCPIBlock(btn) {
  btn.closest('.cpi-block').remove();
  recalcTotal();
  scheduleSave();
}

/* ── Row management ── */
function removeRow(btn) {
  btn.closest('tr').remove();
  recalcTotal();
  scheduleSave();
}

function addMatRow(btn) {
  btn.closest('.cpi-block').querySelector('.mat-body')
     .insertAdjacentHTML('beforeend', cpiRowHTML('Item name'));
  scheduleSave();
}

function addLabRow(btn) {
  btn.closest('.cpi-block').querySelector('.lab-body')
     .insertAdjacentHTML('beforeend', cpiRowHTML('Workforce type'));
  scheduleSave();
}

/* ══════════════════════════════════════════════════════════════
CURRENCY FORMATTING
Peso fields are type="text" (number inputs reject commas), so we
format on blur and strip the formatting back out on focus / parse.
══════════════════════════════════════════════════════════════ */

/** "₱300,000.00" / "300,000" / " 300000 " → 300000 (number). */
function parseCurrency(value) {
  return parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

/** 300000 → "300,000.00" (the ₱ sign lives in the field's label). */
function formatCurrency(num) {
  return num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// One delegated listener pair covers desiredCover AND every CPI cost
// row, including rows added later — focusin/focusout bubble up to the
// document, unlike plain focus/blur.
document.addEventListener('focusout', (e) => {
  if (!e.target.matches?.('.currency-input')) return;
  if (e.target.value.trim() === '') return;   // leave empty fields empty
  e.target.value = formatCurrency(parseCurrency(e.target.value));
});

document.addEventListener('focusin', (e) => {
  if (!e.target.matches?.('.currency-input')) return;
  if (e.target.value.trim() === '') return;
  e.target.value = String(parseCurrency(e.target.value)); // raw digits while editing
});

/* ── Live validation on blur for numeric & DAP fields ───────────
   focusout (unlike blur) bubbles to document, so one listener pair
   covers every number/currency field — including CPI rows added
   later. Registered AFTER the currency formatter above so the value
   is already normalised by the time we validate it. */
document.addEventListener('focusout', (e) => {
  const t = e.target;
  if (t?.matches?.('input[type="number"], .currency-input')) {
    validateNumberField(t);
  }
});

// Days-After-Planting: on top of the generic numeric check, flag a day
// that duplicates another schedule's day (otherwise only caught on Next).
// .dap-input has no id, so showFieldError can't attach a message — we
// highlight the field and surface the reason via a toast, mirroring
// validateStep(). Runs after the numeric listener so its hideFieldError
// doesn't wipe the highlight we add here.
document.addEventListener('focusout', (e) => {
  const t = e.target;
  if (!t?.classList?.contains('dap-input')) return;
  const raw = t.value.trim();
  if (raw === '') return;
  const dupes = [...document.querySelectorAll('.dap-input')]
    .filter(i => i !== t && i.value.trim() === raw);
  if (dupes.length > 0) {
    t.classList.add('field-error');
    showToast('Cannot have multiple schedules for the same Day After Planting.');
  }
});

// Clear a live numeric / DAP error the moment the user edits the field,
// matching how clearErrorOnInput behaves for required fields. For no-id
// fields (DAP) hideFieldError just removes the red outline.
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t?.matches?.('input[type="number"], .currency-input, .dap-input')) {
    hideFieldError(t);
  }
});

/* ── Grand total (derived) ── */
function recalcTotal() {
  let total = 0;
  document.querySelectorAll('.cost-input').forEach(inp => {
    total += parseCurrency(inp.value);
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

  /* 5b. Clear the perils group error as soon as any peril is ticked. */
  ['perilFlood', 'perilDrought', 'perilTyphoon', 'perilPest'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      hideFieldError(document.getElementById('perilsGroup'));
    });
  });

  /* 5c. Contact number: flag a typed-but-not-yet-added value when focus
     leaves the field (same rule as doAddTag). The message hangs on the
     wrap; typing again clears it. Empty is fine — they may just be done. */
  const tagInput = document.querySelector('#contactWrap .tag-input');
  if (tagInput) {
    const wrap = document.getElementById('contactWrap');
    tagInput.addEventListener('blur', () => {
      const val = tagInput.value.trim();
      if (val && (val.length < 7 || !/^\d+$/.test(val))) {
        showFieldError(wrap, 'Please enter a valid phone number (digits only, at least 7 digits).');
      }
    });
    tagInput.addEventListener('input', () => hideFieldError(wrap));
  }

  /* 6. Early active-policy warning once name AND birthday are filled in */
  document.getElementById('proposerName')?.addEventListener('blur', checkActivePolicy);
  document.getElementById('birthday')?.addEventListener('change', checkActivePolicy);

  /* 7. Set default date for proposer date (today) */
  const proposeDate = document.getElementById('proposeDate');
  if (proposeDate && !proposeDate.value) {
    proposeDate.value = todayLocal();
  }

  /* 8. Restore a saved draft (if any), then guarantee one CPI schedule
        block exists so step 5 is never empty. restoreDraft() rebuilds
        its own blocks, so we only add the default block when it didn't. */
  const draftRestored = restoreDraft();
  if (!document.querySelector('.cpi-block')) {
    document.getElementById('cpiBlocksContainer').appendChild(buildCPIBlock(true));
  }

  /* 9. Start auto-saving every change to localStorage. */
  initAutosave(draftRestored);

  /* 9b. Coverage dates. Both dates allow today and onwards — coverage can't
         start in the past. We set min === today so past days are greyed/
         un-clickable while today and future days stay selectable, and default
         the START to today as a convenience (the user can still pick a later
         day). The END date follows the chosen start: see the change handler
         below, which keeps end.min >= start so you can't pick an end before
         the start. Runs after restoreDraft() so a stale value can't win. */
  const today = todayLocal(); // local YYYY-MM-DD, not UTC
  const coverageStart = document.getElementById('coverageStart');
  const coverageEnd = document.getElementById('coverageEnd');
  if (coverageStart) {
    coverageStart.min = today;
    if (!coverageStart.value) coverageStart.value = today; // sensible default
  }
  if (coverageEnd) {
    coverageEnd.min = coverageStart?.value || today;
  }
  // Keep the end picker's floor in sync with the chosen start date.
  if (coverageStart && coverageEnd) {
    coverageStart.addEventListener('change', () => {
      coverageEnd.min = coverageStart.value || today;
      // If the end is now before the new start, clear it so it can't be invalid.
      if (coverageEnd.value && coverageEnd.value < coverageEnd.min) {
        coverageEnd.value = '';
      }
    });
  }

  /* 10. Associate labels with their fields, and set the pill disabled-states
         for the current step (so unreached steps aren't clickable on load). */
  associateLabels();
  updatePills(cur);

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
  scheduleSave();
}

/* ══════════════════════════════════════════════════════════════
   AUTOSAVE — persist the in-progress application to the browser's
   localStorage so a refresh or accidental navigation never wipes the
   user's work. localStorage is a small key→string store that survives
   page reloads (unlike a JS variable), so we JSON-stringify a snapshot
   of the form into it on every change and read it back on load. The
   "Draft auto-saved" badge in the header reflects this.
══════════════════════════════════════════════════════════════ */

const DRAFT_KEY = 'pcic-draft';   // the localStorage key we read/write
let draftTimer = null;            // holds the debounce timeout id
let restoringDraft = false;       // true while restoreDraft() rebuilds the form

/* Read the whole form into a plain object we can JSON-stringify. */
function collectDraft() {
  const fields = {};   // text/number/date/select values, keyed by element id
  const checks = {};   // checkbox states, keyed by element id

  // Every form control that has an id. The dynamic CPI inputs and the
  // contact tag-input carry classes instead of ids, so they're skipped
  // here and handled separately below.
  document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
    if (el.type === 'checkbox') checks[el.id] = el.checked;
    else fields[el.id] = el.value;
  });

  // Contact numbers are rendered as <span class="tag"> chips, not inputs,
  // so pull their text back out (dropping the "×" remove glyph).
  const contacts = Array.from(document.querySelectorAll('#contactWrap .tag'))
    .map(t => t.textContent.replace('×', '').trim());

  // CPI schedule blocks: store each block's "days after planting" plus its
  // material and labor rows as { c0, c1, c2 } (the three inputs per row).
  const cpi = [];
  document.querySelectorAll('.cpi-block').forEach(block => {
    const readRows = sel => Array.from(block.querySelectorAll(sel + ' tr')).map(tr => {
      const i = tr.querySelectorAll('input');
      return { c0: i[0]?.value || '', c1: i[1]?.value || '', c2: i[2]?.value || '' };
    });
    cpi.push({
      dap: block.querySelector('.dap-input')?.value || '',
      materials: readRows('.mat-body'),
      labor: readRows('.lab-body'),
    });
  });

  return {
    v: 1,                 // schema version — lets us ignore old drafts safely
    step: cur,            // which step the user was on
    savedAt: Date.now(),
    fields, checks, contacts,
    variety2Shown: !document.getElementById('varietyBlock2')?.classList.contains('hidden'),
    cpi,
  };
}

/* Write the snapshot. Wrapped in try/catch because localStorage throws in
   private-browsing mode or when the quota is exceeded. */
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
    setDraftStatus('Draft saved');
  } catch (_) { /* storage unavailable — fail silently, form still works */ }
}

/* Debounce: typing fires many input events per second, so wait until the
   user pauses (400ms) before writing, instead of saving on every keystroke. */
function scheduleSave() {
  if (restoringDraft) return;   // ignore the DOM churn restore itself causes
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 400);
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
}

function setDraftStatus(text) {
  const el = document.getElementById('draftStatusText');
  if (el) el.textContent = text;
}

/* Re-apply a saved snapshot to the DOM. Returns true if one was found. */
function restoreDraft() {
  let raw;
  try { raw = localStorage.getItem(DRAFT_KEY); } catch (_) { return false; }
  if (!raw) return false;

  let d;
  try { d = JSON.parse(raw); } catch (_) { clearDraft(); return false; }
  if (!d || d.v !== 1) return false;   // missing or older schema — ignore

  restoringDraft = true;   // mute scheduleSave() while we rebuild the form

  // 1. Simple fields and checkboxes
  Object.entries(d.fields || {}).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  Object.entries(d.checks || {}).forEach(([id, on]) => {
    const el = document.getElementById(id);
    if (el) el.checked = on;
  });

  // 2. Re-run the handlers that react to those values, so dependent UI
  //    (locked spouse fields, the tribe field) matches the restored state.
  toggleSpouse();
  toggleTribe();

  // 3. Contact tags — rebuild the chips before the tag-input.
  if (Array.isArray(d.contacts)) {
    const wrap  = document.getElementById('contactWrap');
    const input = wrap?.querySelector('.tag-input');
    d.contacts.forEach(val => {
      if (!val) return;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${val} <button onclick="removeTag(this)" aria-label="Remove ${val}">×</button>`;
      wrap.insertBefore(tag, input);
    });
  }

  // 4. Second variety block (field values were already set in step 1; here
  //    we just reveal the block if it was open).
  if (d.variety2Shown) toggleVariety2(true);

  // 5. CPI schedules — rebuild each block, then fill its rows.
  if (Array.isArray(d.cpi) && d.cpi.length) {
    const container = document.getElementById('cpiBlocksContainer');
    container.innerHTML = '';
    d.cpi.forEach((sched, idx) => {
      const block = buildCPIBlock(idx === 0);   // first block has no Remove btn
      container.appendChild(block);
      const dap = block.querySelector('.dap-input');
      if (dap) dap.value = sched.dap || '';
      applyCpiRows(block, '.mat-body', sched.materials);
      applyCpiRows(block, '.lab-body', sched.labor);
    });
  }

  // 6. Recompute the derived displays from the restored base data.
  calcAge('');
  calcAge('2');
  recalcTotal();

  // 7. Return the user to the step they left off on.
  if (typeof d.step === 'number' && d.step >= 0 && d.step < TOTAL) {
    document.getElementById(`page-${cur}`)?.classList.remove('active');
    cur = d.step;
    document.getElementById(`page-${cur}`)?.classList.add('active');
    syncNav();
  }

  restoringDraft = false;
  return true;
}

/* Ensure a CPI <tbody> has enough rows for the saved data, then fill them.
   A freshly built block already contains one empty row, so we only add more
   as needed. */
function applyCpiRows(block, bodySel, rows) {
  rows = rows || [];
  const tbody  = block.querySelector(bodySel);
  if (!tbody) return;
  const addRow = bodySel === '.mat-body' ? addMatRow : addLabRow;

  while (tbody.querySelectorAll('tr').length < rows.length) {
    addRow(tbody);   // addMatRow/addLabRow find the block via .closest()
  }

  const trs = tbody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    const inputs = trs[i].querySelectorAll('input');
    if (inputs[0]) inputs[0].value = row.c0 || '';
    if (inputs[1]) inputs[1].value = row.c1 || '';
    if (inputs[2]) inputs[2].value = row.c2 || '';
  });
}

/* Attach the listeners that keep the draft up to date. */
function initAutosave(restored) {
  setDraftStatus(restored ? 'Draft restored' : 'Draft auto-saved');

  // One delegated listener pair covers every field — including CPI rows
  // added later — because input/change events bubble up to the document.
  document.addEventListener('input',  scheduleSave);
  document.addEventListener('change', scheduleSave);
}

/* ══════════════════════════════════════════════════════════════
   ACCESSIBILITY — associate each <label> with its control.
   Instead of hand-writing for="" on 40+ labels, we link each label to
   its field's id at load time. Screen readers read the resulting DOM, so
   this produces real label↔control associations and lets a click on the
   label focus the field. Controls already wrapped by their own <label>
   (the perils checkboxes, the IP toggle) are skipped — they're associated
   implicitly or via aria-label.
══════════════════════════════════════════════════════════════ */
function associateLabels() {
  document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
    if (el.closest('label')) return;
    const label = el.closest('div')?.querySelector('label');
    if (label && !label.htmlFor) label.htmlFor = el.id;
  });
}

/* ══════════════════════════════════════════════════════════════
   REVIEW SUMMARY — a read-only recap rendered on the final step so the
   applicant can check their answers before submitting. Built with the DOM
   (textContent), never innerHTML, so nothing the user typed can inject markup.
══════════════════════════════════════════════════════════════ */
function renderReview() {
  const box = document.getElementById('reviewSummary');
  if (!box) return;
  const val = id => (document.getElementById(id)?.value || '').trim();

  const perils = [
    ['perilFlood', 'Flood'], ['perilDrought', 'Drought'],
    ['perilTyphoon', 'Typhoon'], ['perilPest', 'Pest Infestation'],
  ].filter(([id]) => document.getElementById(id)?.checked).map(([, name]) => name);

  const contacts = Array.from(document.querySelectorAll('#contactWrap .tag'))
    .map(t => t.textContent.replace('×', '').trim()).join(', ');

  const block2Open = !document.getElementById('varietyBlock2')?.classList.contains('hidden');
  const varieties = [val('variety'), block2Open ? val('variety2') : ''].filter(Boolean).join(', ');

  const rows = [
    ['Proposer',        val('proposerName')],
    ['Address',         val('address')],
    ['Contact no.',     contacts],
    ['Crop',            val('crops')],
    ['Plantation size', val('plantationSize') && `${val('plantationSize')} ha`],
    ['Coverage',        val('coverageStart') && val('coverageEnd') && `${val('coverageStart')} → ${val('coverageEnd')}`],
    ['Amount of cover', val('desiredCover') && `₱${val('desiredCover')}`],
    ['Perils',          perils.join(', ')],
    ['Farm',            val('plantationName')],
    ['Variety',         varieties],
    ['Total CPI cost',  document.getElementById('totalCost')?.textContent],
  ];

  const dl = document.createElement('dl');
  dl.className = 'review-list';
  rows.forEach(([label, value]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value || '—';
    dl.append(dt, dd);
  });

  box.replaceChildren(dl);
}