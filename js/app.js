(function () {
  const ANNUAL_RATE = 4.75;
  const STORAGE_KEY = 'atb-loan-public-check.draft';
  const MAX_OTHER_DEBTS = 5;
  const LEVELS = ['ป.1', 'ป.2', 'ป.3', 'น.1', 'น.2', 'น.3'];
  const OVER_DEPOSIT_OPTIONS = [
    { value: 'SELF_ONLY', label: 'กู้เฉพาะเงินตัวเอง' },
    { value: 'OVER_1K_100K', label: 'เกินเงินฝากตั้งแต่ 1,000 แต่ไม่เกิน 100,000 บาท' },
    { value: 'OVER_101K_300K', label: 'เกินเงินฝากตั้งแต่ 101,000 แต่ไม่เกิน 300,000 บาท' },
    { value: 'OVER_301K_500K', label: 'เกินเงินฝากตั้งแต่ 301,000 แต่ไม่เกิน 500,000 บาท' },
    { value: 'DOUBLE_DEPOSIT_MAX_500K', label: '2 เท่าของเงินฝาก แต่ไม่เกิน 500,000 บาท' }
  ];

  const elements = {
    appCard: document.getElementById('appCard'),
    resetBtn: document.getElementById('resetBtn'),
    salaryLevel: document.getElementById('salaryLevel'),
    salaryStep: document.getElementById('salaryStep'),
    salaryAmount: document.getElementById('salaryAmount'),
    latestMonth: document.getElementById('latestMonth'),
    totalIncome: document.getElementById('totalIncome'),
    totalDeductions: document.getElementById('totalDeductions'),
    remainingIncome: document.getElementById('remainingIncome'),
    depositAmount: document.getElementById('depositAmount'),
    depositLoanAmount: document.getElementById('depositLoanAmount'),
    depositLoanHint: document.getElementById('depositLoanHint'),
    overDepositMode: document.getElementById('overDepositMode'),
    totalLoanAmount: document.getElementById('totalLoanAmount'),
    termMonths: document.getElementById('termMonths'),
    monthlyPayment: document.getElementById('monthlyPayment'),
    hasOldDebt: document.getElementById('hasOldDebt'),
    oldDebtSection: document.getElementById('oldDebtSection'),
    oldDebtRequested: document.getElementById('oldDebtRequested'),
    oldDebtCurrent: document.getElementById('oldDebtCurrent'),
    oldDebtInstallment: document.getElementById('oldDebtInstallment'),
    differenceAmount: document.getElementById('differenceAmount'),
    hasOtherDebt: document.getElementById('hasOtherDebt'),
    otherDebtSection: document.getElementById('otherDebtSection'),
    otherDebtList: document.getElementById('otherDebtList'),
    otherDebtNetAmount: document.getElementById('otherDebtNetAmount'),
    otherDebtMonthlyDiff: document.getElementById('otherDebtMonthlyDiff'),
    oneThirdAmount: document.getElementById('oneThirdAmount'),
    remainingAfterLoan: document.getElementById('remainingAfterLoan'),
    guarantorCount: document.getElementById('guarantorCount')
  };

  let isPristine = true;
  let otherDebtCount = 1;

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const thaiToArabic = String(value ?? '').replace(/[\u0E50-\u0E59]/g, (d) => String(d.charCodeAt(0) - 0x0E50));
    const cleaned = thaiToArabic.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function setComputedValue(input, value, showWhenPristine = false) {
    if (!input) return;
    if (isPristine && !showWhenPristine) {
      input.value = '';
      return;
    }
    input.value = formatMoney(value);
  }

  function bindMoneyInput(input) {
    if (!input) return;
    input.addEventListener('focus', () => {
      const raw = String(input.value ?? '').trim();
      if (!raw) return;
      const parsed = parseMoney(raw);
      input.value = parsed ? String(parsed) : '';
      setTimeout(() => input.select(), 0);
    });
    input.addEventListener('blur', () => {
      const trimmed = String(input.value ?? '').trim();
      if (!trimmed) {
        input.value = '';
      } else {
        input.value = formatMoney(parseMoney(trimmed));
      }
      markDirtyAndRecalculate();
    });
    input.addEventListener('input', markDirtyAndRecalculate);
  }

  function monthlyPayment(principal, annualRate, months) {
    const p = Number(principal) || 0;
    const n = Number(months) || 0;
    if (p <= 0 || n <= 0) return 0;
    const r = annualRate / 100 / 12;
    if (r === 0) return p / n;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  function getLatestMonthText() {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const now = new Date();
    const year = (now.getFullYear() + 543).toString().slice(-2);
    return months[now.getMonth()] + ' ' + year;
  }

  function stepSortKey(step) {
    const isRelief = String(step).includes('/เยียวยา');
    const numeric = Number(String(step).replace('/เยียวยา', ''));
    return { isRelief, numeric: Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER };
  }

  function getSortedSteps(level) {
    const levelData = (window.SALARY_DATA || {})[level] || {};
    return Object.keys(levelData).sort((a, b) => {
      const keyA = stepSortKey(a);
      const keyB = stepSortKey(b);
      if (keyA.isRelief !== keyB.isRelief) return keyA.isRelief ? 1 : -1;
      if (keyA.numeric !== keyB.numeric) return keyA.numeric - keyB.numeric;
      return String(a).localeCompare(String(b), 'th');
    });
  }

  function populateLevels() {
    elements.salaryLevel.innerHTML = LEVELS.map((level) => `<option value="${level}">${level}</option>`).join('');
  }

  function populateOverDepositModes() {
    elements.overDepositMode.innerHTML = OVER_DEPOSIT_OPTIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
  }

  function populateSteps(level, preferredStep) {
    const steps = getSortedSteps(level);
    elements.salaryStep.innerHTML = steps.map((step) => `<option value="${step}">${step}</option>`).join('');
    if (preferredStep && steps.includes(preferredStep)) elements.salaryStep.value = preferredStep;
  }

  function getSalary(level, step) {
    const levelData = (window.SALARY_DATA || {})[level] || {};
    return Number(levelData[step] || 0);
  }

  function normalizeDepositForLoan(amount) {
    const value = parseMoney(amount);
    if (value < 1000) return 0;
    return Math.floor(value / 1000) * 1000;
  }


  function clampDepositLoanAmount(rawValue, eligibleDeposit) {
    const typed = parseMoney(rawValue);
    if (eligibleDeposit < 1000) return 0;
    if (typed <= 0) return eligibleDeposit;
    const atLeastMinimum = Math.max(typed, 1000);
    return Math.min(normalizeDepositForLoan(atLeastMinimum), eligibleDeposit);
  }

  function syncDepositLoanInput(rawDeposit) {
    const eligibleDeposit = normalizeDepositForLoan(rawDeposit);
    const hasValue = String(elements.depositLoanAmount.value || '').trim();
    const finalValue = clampDepositLoanAmount(elements.depositLoanAmount.value, eligibleDeposit);
    const typed = parseMoney(elements.depositLoanAmount.value);
    const isFocused = document.activeElement === elements.depositLoanAmount;

    if (!hasValue && !isPristine) {
      elements.depositLoanAmount.value = formatMoney(eligibleDeposit);
      elements.depositLoanHint.classList.add('hidden');
      elements.depositLoanHint.textContent = '';
      return eligibleDeposit;
    }

    if (!isFocused && hasValue) elements.depositLoanAmount.value = formatMoney(finalValue);

    if (eligibleDeposit < 1000) {
      elements.depositLoanHint.classList.remove('hidden');
      elements.depositLoanHint.textContent = "เงินฝากที่สามารถกู้ได้ต้องตั้งแต่ 1,000.00 บาทขึ้นไป";
    } else if (typed > eligibleDeposit) {
      elements.depositLoanHint.classList.remove('hidden');
      elements.depositLoanHint.textContent = 'ยอดที่แก้ไขต้องไม่เกินเงินฝากที่สามารถกู้ได้ ' + formatMoney(eligibleDeposit) + ' บาท';
    } else if (hasValue && typed > 0 && typed < 1000) {
      elements.depositLoanHint.classList.remove('hidden');
      elements.depositLoanHint.textContent = "ระบบปรับยอดเงินฝากที่สามารถกู้ได้เป็นขั้นต่ำ 1,000.00 บาท";
    } else if (hasValue && typed !== finalValue) {
      elements.depositLoanHint.classList.remove('hidden');
      elements.depositLoanHint.textContent = 'ระบบใช้ยอดเต็มพันตามระเบียบ คือ ' + formatMoney(finalValue) + ' บาท';
    } else {
      elements.depositLoanHint.classList.add('hidden');
      elements.depositLoanHint.textContent = '';
    }

    return finalValue;
  }

  function computeOverDeposit(mode, depositLoanAmount) {
    const deposit = normalizeDepositForLoan(depositLoanAmount);
    switch (mode) {
      case 'OVER_1K_100K': return 100000;
      case 'OVER_101K_300K': return 300000;
      case 'OVER_301K_500K': return 500000;
      case 'DOUBLE_DEPOSIT_MAX_500K': return Math.min(deposit, 500000);
      case 'SELF_ONLY':
      default: return 0;
    }
  }

  function getAllowedTerms(totalLoanAmount) {
    const loan = parseMoney(totalLoanAmount);
    if (loan <= 140000) return [24, 48];
    if (loan <= 290000) return [48, 60, 72, 84, 96];
    return [48, 60, 72, 84, 96, 120];
  }

  function formatTermLabel(months) {
    return `${months} งวด / ${months / 12} ปี`;
  }

  function getGuarantorText(mode) {
    switch (mode) {
      case 'OVER_1K_100K': return '1 คน';
      case 'OVER_101K_300K':
      case 'DOUBLE_DEPOSIT_MAX_500K': return '2 คน';
      case 'OVER_301K_500K': return '3 คน';
      case 'SELF_ONLY':
      default: return '-';
    }
  }

  function getOtherDebtRows() {
    return Array.from(elements.otherDebtList.querySelectorAll('.other-debt-item'));
  }

  function getOtherDebtEntries() {
    return getOtherDebtRows().map((row) => ({
      institution: row.querySelector('[data-field="institution"]')?.value || "สหกรณ์",
      current: parseMoney(row.querySelector('[data-field="current"]')?.value),
      installment: parseMoney(row.querySelector('[data-field="installment"]')?.value)
    }));
  }

  function collectOtherDebtDraft() {
    return getOtherDebtRows().map((row) => ({
      institution: row.querySelector('[data-field="institution"]')?.value || "สหกรณ์",
      current: row.querySelector('[data-field="current"]')?.value || '',
      installment: row.querySelector('[data-field="installment"]')?.value || ''
    }));
  }

  function renderOtherDebtRows(entries = collectOtherDebtDraft()) {
    const count = Math.min(Math.max(otherDebtCount, 1), MAX_OTHER_DEBTS);
    const rows = [];
    for (let index = 0; index < count; index += 1) {
      const item = entries[index] || {};
      rows.push([
        '<div class="other-debt-item" data-index="' + index + '">',
        '<div class="other-debt-title">' + "หนี้อื่นรายการที่" + ' ' + (index + 1) + '</div>',
        '<div class="grid grid-3">',
        '<label class="field"><span>สถาบันเจ้าหนี้</span><select data-field="institution"><option value="สหกรณ์">สหกรณ์</option><option value="ธนาคารออมสิน">ธนาคารออมสิน</option><option value="ธนาคารกรุงไทย">ธนาคารกรุงไทย</option><option value="อื่น ๆ">อื่น ๆ</option></select></label>',
        '<label class="field"><span>ยอดหนี้คงเหลือโดยประมาณ</span><input data-field="current" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" /></label>',
        '<label class="field"><span>ยอดผ่อนต่อเดือนที่ต้องการปิด</span><input data-field="installment" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" /></label>',
        '</div>',
        '</div>'
      ].join(''));
    }
    if (count < MAX_OTHER_DEBTS) {
      rows.push([
        '<div class="debt-toggle-wrap other-debt-next">',
        '<label class="debt-toggle"><span>' + "เพิ่มหนี้อื่นรายการที่" + ' ' + (count + 1) + '</span><input id="addOtherDebt" type="checkbox" /></label>',
        '</div>'
      ].join(''));
    }
    elements.otherDebtList.innerHTML = rows.join('');
    getOtherDebtRows().forEach((row, index) => {
      const item = entries[index] || {};
      const institution = row.querySelector('[data-field="institution"]');
      const current = row.querySelector('[data-field="current"]');
      const installment = row.querySelector('[data-field="installment"]');
      institution.value = item.institution || "สหกรณ์";
      current.value = item.current || '';
      installment.value = item.installment || '';
      bindMoneyInput(current);
      bindMoneyInput(installment);
      institution.addEventListener('change', markDirtyAndRecalculate);
    });
  }

  function renderTermOptions(totalLoanAmount) {
    const allowed = getAllowedTerms(totalLoanAmount);
    const current = Number(elements.termMonths.value || 0);
    elements.termMonths.innerHTML = allowed.map((months) => `<option value="${months}">${formatTermLabel(months)}</option>`).join('');
    elements.termMonths.value = String(allowed.includes(current) ? current : allowed[allowed.length - 1]);
  }

  function updateStatusCard(remainingAfterLoan, oneThird) {
    elements.appCard.classList.remove('status-green', 'status-yellow', 'status-red');
    if (isPristine) {
      elements.appCard.classList.add('status-green');
      return;
    }
    const passOneThird = remainingAfterLoan > oneThird;
    const passFiveThousand = remainingAfterLoan > 5000;
    if (passOneThird && passFiveThousand) {
      elements.appCard.classList.add('status-green');
      return;
    }
    if (passOneThird || passFiveThousand) {
      elements.appCard.classList.add('status-yellow');
      return;
    }
    elements.appCard.classList.add('status-red');
  }

  function getDraftData() {
    return {
      isPristine,
      salaryLevel: elements.salaryLevel.value,
      salaryStep: elements.salaryStep.value,
      totalIncome: elements.totalIncome.value,
      totalDeductions: elements.totalDeductions.value,
      depositAmount: elements.depositAmount.value,
      depositLoanAmount: elements.depositLoanAmount.value,
      overDepositMode: elements.overDepositMode.value,
      termMonths: elements.termMonths.value,
      hasOldDebt: elements.hasOldDebt.checked,
      oldDebtRequested: elements.oldDebtRequested.value,
      oldDebtCurrent: elements.oldDebtCurrent.value,
      oldDebtInstallment: elements.oldDebtInstallment.value,
      hasOtherDebt: elements.hasOtherDebt.checked,
      otherDebtCount,
      otherDebts: collectOtherDebtDraft()
    };
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getDraftData())); }
    catch (error) { console.warn('saveDraft failed', error); }
  }

  function restoreInputValue(input, value) {
    if (input) input.value = value || '';
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return false;
      elements.salaryLevel.value = LEVELS.includes(draft.salaryLevel) ? draft.salaryLevel : LEVELS[0];
      populateSteps(elements.salaryLevel.value, draft.salaryStep);
      restoreInputValue(elements.totalIncome, draft.totalIncome);
      restoreInputValue(elements.totalDeductions, draft.totalDeductions);
      restoreInputValue(elements.depositAmount, draft.depositAmount);
      restoreInputValue(elements.depositLoanAmount, draft.depositLoanAmount);
      elements.overDepositMode.value = draft.overDepositMode || 'SELF_ONLY';
      elements.hasOldDebt.checked = Boolean(draft.hasOldDebt);
      restoreInputValue(elements.oldDebtRequested, draft.oldDebtRequested);
      restoreInputValue(elements.oldDebtCurrent, draft.oldDebtCurrent);
      restoreInputValue(elements.oldDebtInstallment, draft.oldDebtInstallment);
      elements.hasOtherDebt.checked = Boolean(draft.hasOtherDebt);
      const legacyOtherDebt = draft.otherDebtCurrent || draft.otherDebtInstallment
        ? [{ institution: draft.otherDebtInstitution || 'สหกรณ์', current: draft.otherDebtCurrent, installment: draft.otherDebtInstallment }]
        : null;
      const otherDebts = Array.isArray(draft.otherDebts) ? draft.otherDebts : legacyOtherDebt;
      otherDebtCount = Math.min(Math.max(Number(draft.otherDebtCount) || (otherDebts ? otherDebts.length : 1), 1), MAX_OTHER_DEBTS);
      renderOtherDebtRows(otherDebts || []);
      isPristine = Boolean(draft.isPristine);
      recalculate();
      if (draft.termMonths) {
        const allowed = getAllowedTerms(parseMoney(elements.totalLoanAmount.value));
        if (allowed.includes(Number(draft.termMonths))) {
          elements.termMonths.value = String(draft.termMonths);
          recalculate();
        }
      }
      return true;
    } catch (error) {
      console.warn('loadDraft failed', error);
      return false;
    }
  }

  function recalculate() {
    const salary = getSalary(elements.salaryLevel.value, elements.salaryStep.value);
    const totalIncome = parseMoney(elements.totalIncome.value);
    const totalDeductions = parseMoney(elements.totalDeductions.value);
    const remainingIncome = totalIncome - totalDeductions;
    const rawDeposit = parseMoney(elements.depositAmount.value);
    const depositLoanAmount = syncDepositLoanInput(rawDeposit);
    const overDepositMode = elements.overDepositMode.value;
    const overDepositAmount = computeOverDeposit(overDepositMode, depositLoanAmount);
    const totalLoanAmount = depositLoanAmount + overDepositAmount;

    renderTermOptions(totalLoanAmount);
    const termMonths = Number(elements.termMonths.value || 0);
    const monthlyInstallment = monthlyPayment(totalLoanAmount, ANNUAL_RATE, termMonths);

    const hasOldDebt = elements.hasOldDebt.checked;
    const oldDebtCurrent = hasOldDebt ? parseMoney(elements.oldDebtCurrent.value) : 0;
    const oldDebtInstallment = hasOldDebt ? parseMoney(elements.oldDebtInstallment.value) : 0;
    const differenceAmount = hasOldDebt ? totalLoanAmount - oldDebtCurrent : 0;

    const hasOtherDebt = elements.hasOtherDebt.checked;
    const otherDebtEntries = hasOtherDebt ? getOtherDebtEntries() : [];
    const otherDebtCurrent = otherDebtEntries.reduce((sum, item) => sum + item.current, 0);
    const otherDebtInstallment = otherDebtEntries.reduce((sum, item) => sum + item.installment, 0);
    const otherDebtNetAmount = hasOtherDebt ? totalLoanAmount - oldDebtCurrent - otherDebtCurrent : 0;
    const otherDebtMonthlyDiff = hasOtherDebt ? otherDebtInstallment - monthlyInstallment : 0;

    const oneThirdAmount = totalIncome / 3;
    const remainingAfterLoan = remainingIncome - monthlyInstallment + oldDebtInstallment + otherDebtInstallment;
    const guarantorText = getGuarantorText(overDepositMode);

    elements.salaryAmount.value = formatMoney(salary);
    elements.latestMonth.value = getLatestMonthText();
    setComputedValue(elements.remainingIncome, remainingIncome);
    setComputedValue(elements.totalLoanAmount, totalLoanAmount);
    setComputedValue(elements.monthlyPayment, monthlyInstallment);
    setComputedValue(elements.differenceAmount, differenceAmount);
    setComputedValue(elements.otherDebtNetAmount, otherDebtNetAmount);
    setComputedValue(elements.otherDebtMonthlyDiff, otherDebtMonthlyDiff);
    setComputedValue(elements.oneThirdAmount, oneThirdAmount);
    setComputedValue(elements.remainingAfterLoan, remainingAfterLoan);
    elements.guarantorCount.value = isPristine ? '' : guarantorText;
    elements.oldDebtSection.classList.toggle('hidden', !hasOldDebt);
    elements.otherDebtSection.classList.toggle('hidden', !hasOtherDebt);
    updateStatusCard(remainingAfterLoan, oneThirdAmount);
    saveDraft();
  }

  function markDirtyAndRecalculate() {
    isPristine = false;
    recalculate();
  }

  function clearEditable(input) {
    if (input) input.value = '';
  }

  function resetAll() {
    isPristine = true;
    elements.salaryLevel.value = LEVELS[0];
    const firstSteps = getSortedSteps(LEVELS[0]);
    populateSteps(LEVELS[0], firstSteps[0]);
    [
      elements.totalIncome,
      elements.totalDeductions,
      elements.depositAmount,
      elements.depositLoanAmount,
      elements.oldDebtRequested,
      elements.oldDebtCurrent,
      elements.oldDebtInstallment
    ].forEach(clearEditable);
    elements.overDepositMode.value = 'SELF_ONLY';
    elements.hasOldDebt.checked = false;
    elements.hasOtherDebt.checked = false;
    otherDebtCount = 1;
    renderOtherDebtRows([]);
    elements.oldDebtSection.classList.add('hidden');
    elements.otherDebtSection.classList.add('hidden');
    elements.depositLoanHint.classList.add('hidden');
    elements.guarantorCount.value = '';
    [
      elements.remainingIncome,
      elements.totalLoanAmount,
      elements.monthlyPayment,
      elements.differenceAmount,
      elements.otherDebtNetAmount,
      elements.otherDebtMonthlyDiff,
      elements.oneThirdAmount,
      elements.remainingAfterLoan
    ].forEach(clearEditable);
    renderTermOptions(0);
    localStorage.removeItem(STORAGE_KEY);
    recalculate();
  }

  function bindEvents() {
    elements.salaryLevel.addEventListener('change', () => {
      populateSteps(elements.salaryLevel.value);
      markDirtyAndRecalculate();
    });
    elements.salaryStep.addEventListener('change', markDirtyAndRecalculate);
    elements.overDepositMode.addEventListener('change', markDirtyAndRecalculate);
    elements.termMonths.addEventListener('change', markDirtyAndRecalculate);
    elements.hasOldDebt.addEventListener('change', markDirtyAndRecalculate);
    elements.hasOtherDebt.addEventListener('change', markDirtyAndRecalculate);
    elements.otherDebtList.addEventListener('change', (event) => {
      if (event.target.id === 'addOtherDebt' && event.target.checked) {
        otherDebtCount = Math.min(otherDebtCount + 1, MAX_OTHER_DEBTS);
        renderOtherDebtRows();
      }
      markDirtyAndRecalculate();
    });
    elements.resetBtn.addEventListener('click', resetAll);
    [
      elements.totalIncome,
      elements.totalDeductions,
      elements.depositAmount,
      elements.depositLoanAmount,
      elements.oldDebtRequested,
      elements.oldDebtCurrent,
      elements.oldDebtInstallment
    ].forEach(bindMoneyInput);
  }

  function init() {
    populateLevels();
    populateOverDepositModes();
    elements.latestMonth.value = getLatestMonthText();
    renderOtherDebtRows([]);
    const restored = loadDraft();
    if (!restored) resetAll();
    bindEvents();
  }

  init();
})();
