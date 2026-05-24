/* ═══════════════════════════════════════════════
   PCIC Insurance — script.js
   Handles: navigation, tags, toggle, age calc,
            CPI blocks, total cost, form reset
═══════════════════════════════════════════════ */

/* ── State ── */
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

/* ── Navigation ── */
function goTo(n) {
  if (n > cur) return;
  document.getElementById('page-' + cur).classList.remove('active');
  cur = n;
  document.getElementById('page-' + cur).classList.add('active');
  syncNav();
}

function nextStep() {
  if (cur === TOTAL - 1) {
    document.getElementById('page-' + cur).classList.remove('active');
    document.getElementById('page-success').classList.add('active');
    document.getElementById('formFooter').style.display = 'none';
    updatePills(TOTAL);
    document.getElementById('stepLabel').textContent = 'Application Submitted';
    document.getElementById('stepCounter').textContent = 'Complete';
    document.getElementById('progressFill').style.width = '100%';
    return;
  }
  document.getElementById('page-' + cur).classList.remove('active');
  cur++;
  document.getElementById('page-' + cur).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep() {
  if (cur === 0) return;
  document.getElementById('page-' + cur).classList.remove('active');
  cur--;
  document.getElementById('page-' + cur).classList.add('active');
  syncNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncNav() {
  const btnBack = document.getElementById('btnBack');
  const btnNext = document.getElementById('btnNext');

  btnBack.style.visibility = cur === 0 ? 'hidden' : 'visible';

  if (cur === TOTAL - 1) {
    btnNext.innerHTML = '<i class="ti ti-send text-sm" aria-hidden="true"></i> Submit application';
    btnNext.style.background = '#BA7517';
    btnNext.style.boxShadow = '0 2px 8px rgba(186,117,23,0.3)';
  } else {
    btnNext.innerHTML = 'Next <i class="ti ti-arrow-right text-sm" aria-hidden="true"></i>';
    btnNext.style.background = '#0F6E56';
    btnNext.style.boxShadow = '0 2px 8px rgba(15,110,86,0.3)';
  }

  document.getElementById('stepLabel').textContent = LABELS[cur];
  document.getElementById('stepCounter').textContent = 'Step ' + (cur + 1) + ' of ' + TOTAL;
  document.getElementById('progressFill').style.width = ((cur + 1) / TOTAL * 100).toFixed(2) + '%';
  updatePills(cur);
}

function updatePills(active) {
  document.querySelectorAll('.step-pill').forEach(function (p, i) {
    p.classList.remove('active', 'done');
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

  var tag = document.createElement('span');
  tag.className = 'tag';
  tag.innerHTML = val + ' <button onclick="removeTag(this)" aria-label="Remove">×</button>';
  wrap.insertBefore(tag, input);
  input.value = '';
}

function removeTag(btn) {
  btn.parentElement.remove();
}

/* ── IP / Tribe toggle ── */
function toggleTribe() {
  var on    = document.getElementById('ipToggle').checked;
  var field = document.getElementById('tribeField');
  field.classList.toggle('hidden', !on);
}

/* ── Age group (derived) ── */
function calcAge() {
  var dp = document.getElementById('datePlanting').value;
  if (!dp) return;

  var planted = new Date(dp);
  var now     = new Date();
  var yrs     = now.getFullYear() - planted.getFullYear();
  var mos     = now.getMonth()    - planted.getMonth();

  if (mos < 0) { yrs--; mos += 12; }

  var label = yrs + ' year' + (yrs !== 1 ? 's' : '');
  if (mos) label += ', ' + mos + ' month' + (mos !== 1 ? 's' : '');
  label += ' — Age group: ' + yrs;

  document.getElementById('ageGroup').textContent = label;
}

/* ═══════════════════════════════════════════════
   CPI — Dynamic blocks (one per DAP schedule)
═══════════════════════════════════════════════ */

function buildCPIBlock(isFirst) {
  var block = document.createElement('div');
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

    '<hr class="block-divider" />';

  return block;
}

function addCPIBlock() {
  var container = document.getElementById('cpiBlocksContainer');
  container.appendChild(buildCPIBlock(false));
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
  var tbody = btn.previousElementSibling.querySelector('.mat-body') ||
              btn.closest('.cpi-block').querySelector('.mat-body');
  var tr = document.createElement('tr');
  tr.className = 'border-b border-gray-100';
  tr.innerHTML =
    '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Item name" /></td>' +
    '<td class="px-3 py-2"><input class="cpi-input" type="text" placeholder="Qty + unit" /></td>' +
    '<td class="px-3 py-2"><input class="cpi-input cost-input" type="number" placeholder="0.00" oninput="recalcTotal()" /></td>' +
    '<td class="px-3 py-2"><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash" aria-hidden="true"></i></button></td>';
  tbody.appendChild(tr);
}

function addLabRow(btn) {
  var tbody = btn.closest('.cpi-block').querySelector('.lab-body');
  var tr = document.createElement('tr');
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
  var total = 0;
  document.querySelectorAll('.cost-input').forEach(function (inp) {
    total += parseFloat(inp.value) || 0;
  });
  document.getElementById('totalCost').textContent =
    '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── CPI inline input style ── */
var cpiStyle = document.createElement('style');
cpiStyle.textContent =
  '.cpi-input { background: transparent; border: none; outline: none; width: 100%;' +
  'font-family: "DM Sans", sans-serif; font-size: 0.8125rem; color: #111827;' +
  'padding: 3px 4px; border-radius: 4px; transition: background 0.15s; }' +
  '.cpi-input:focus { background: #E1F5EE; }';
document.head.appendChild(cpiStyle);

/* ── Init ── */
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('cpiBlocksContainer').appendChild(buildCPIBlock(true));
  calcAge();
});