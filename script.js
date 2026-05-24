/* ── State ── */
    let cur = 0;
    const TOTAL = 6;
    const LABELS = [
      'Personal Information',
      'Insurance Coverage',
      'Farm Overview',
      'Crop Variety & Irrigation',
      'Cost of Production Inputs',
      'Validation & Signatures'
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
      document.getElementById('btnBack').style.visibility = cur === 0 ? 'hidden' : 'visible';
      const btn = document.getElementById('btnNext');
      if (cur === TOTAL - 1) {
        btn.className = 'btn btn-submit';
        btn.innerHTML = '<i class="ti ti-send"></i> Submit application';
      } else {
        btn.className = 'btn btn-primary';
        btn.innerHTML = 'Next <i class="ti ti-arrow-right"></i>';
      }
      document.getElementById('stepLabel').textContent = LABELS[cur];
      document.getElementById('stepCounter').textContent = 'Step ' + (cur + 1) + ' of ' + TOTAL;
      document.getElementById('progressFill').style.width = ((cur + 1) / TOTAL * 100).toFixed(2) + '%';
      updatePills(cur);
    }

    function updatePills(active) {
      document.querySelectorAll('.step-pill').forEach((p, i) => {
        p.classList.remove('active', 'done');
        if (i === active) p.classList.add('active');
        else if (i < active) p.classList.add('done');
      });
    }

    function resetForm() {
      location.reload();
    }

    /* ── Tag input ── */
    function addTag(e, wrapId) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const wrap = document.getElementById(wrapId);
      const input = wrap.querySelector('.tag-input');
      const val = input.value.trim();
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

    /* ── IP tribe toggle ── */
    function toggleTribe() {
      const on = document.getElementById('ipToggle').checked;
      document.getElementById('tribeField').style.display = on ? 'block' : 'none';
    }

    /* ── Age group calculation (derived) ── */
    function calcAge() {
      const dp = document.getElementById('datePlanting').value;
      if (!dp) return;
      const planted = new Date(dp);
      const now = new Date();
      let yrs = now.getFullYear() - planted.getFullYear();
      let mos = now.getMonth() - planted.getMonth();
      if (mos < 0) { yrs--; mos += 12; }
      const label = yrs + ' year' + (yrs !== 1 ? 's' : '') + (mos ? ', ' + mos + ' month' + (mos !== 1 ? 's' : '') : '');
      document.getElementById('ageGroup').textContent = label + ' — Age group: ' + yrs;
    }

    /* ── CPI total (derived) ── */
    function recalcTotal() {
      let total = 0;
      document.querySelectorAll('#matBody input[type=number], #labBody input[type=number]').forEach(function(inp) {
        total += parseFloat(inp.value) || 0;
      });
      document.getElementById('totalCost').textContent = '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /* ── CPI row management ── */
    function removeRow(btn) {
      btn.closest('tr').remove();
      recalcTotal();
    }

    function addMatRow() {
      const tb = document.getElementById('matBody');
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" placeholder="Item name" /></td>' +
        '<td><input type="text" placeholder="Qty + unit" /></td>' +
        '<td><input type="number" placeholder="0.00" onchange="recalcTotal()" onkeyup="recalcTotal()" /></td>' +
        '<td><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash"></i></button></td>';
      tb.appendChild(tr);
    }

    function addLabRow() {
      const tb = document.getElementById('labBody');
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" placeholder="Workforce type" /></td>' +
        '<td><input type="text" placeholder="Qty + unit" /></td>' +
        '<td><input type="number" placeholder="0.00" onchange="recalcTotal()" onkeyup="recalcTotal()" /></td>' +
        '<td><button class="del-btn" onclick="removeRow(this)" aria-label="Delete"><i class="ti ti-trash"></i></button></td>';
      tb.appendChild(tr);
    }

    /* ── Init ── */
    calcAge();
    recalcTotal();