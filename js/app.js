(function () {
  const ANNUAL_RATE = 4.75;
  const STORAGE_KEY = 'atb-loan-public-check.draft';
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
    oneThirdAmount: document.getElementById('oneThirdAmount'),
    remainingAfterLoan: document.getElementById('remainingAfterLoan'),
    guarantorCount: document.getElementById('guarantorCount')
  };

  let isPristine = true;

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function setComputedValue(input, value, showWhenPristine = false) {
    if (isPristine && !showWhenPristine) {
      input.value = '';
      return;
    }
    input.value = formatMoney(value);
  }

  function bindMoneyInput(input) {
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
    const [basePart, suffix] = String(step).split('/');
    const numeric = Number(basePart);
    const safeNumeric = Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
    const suffixRank = suffix === 'เยียวยา' ? 1 : 0;
    return { safeNumeric, suffixRank };
  }

  function getSortedSteps(level) {
    const levelData = (window.SALARY_DATA || {})[level] || {};
    return Object.keys(levelData).sort((a, b) => {
      const keyA = stepSortKey(a);
      const keyB = stepSortKey(b);
      if (keyA.safeNumeric !== keyB.safeNumeric) return keyA.safeNumeric - keyB.safeNumeric;
      if (keyA.suffixRank !== keyB.suffixRank) return keyA.suffixRank - keyB.suffixRank;
      return String(a).localeCompare(String(b), 'th');
    });
  }

  function populateLevels() {
    elements.salaryLevel.innerHTML = LEVELS.map((level) => `<option value="${level}">${level}</option>`).join('');
  }

  function populateOverDepositModes() {
    elements.overDepositMode.innerHTML = OVER_DEPOSIT_OPTIONS
      .map((item) => `<option value="${item.value}">${item.label}</option>`)
      .join('');
  }

  function populateSteps(level, preferredStep) {
    const steps = getSortedSteps(level);
    elements.salaryStep.innerHTML = steps.map((step) => `<option value="${step}">${step}</option>`).join('');
    if (preferredStep && steps.includes(preferredStep)) {
      elements.salaryStep.value = preferredStep;
    }
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

  function computeOverDeposit(mode, rawDeposit) {
    const deposit = normalizeDepositForLoan(rawDeposit);
    switch (mode) {
      case 'OVER_1K_100K':
        return 100000;
      case 'OVER_101K_300K':
        return 300000;
      case 'OVER_301K_500K':
        return 500000;
      case 'DOUBLE_DEPOSIT_MAX_500K':
        return Math.min(deposit, 500000);
      case 'SELF_ONLY':
      default:
        return 0;
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
      case 'OVER_1K_100K':
        return '1 คน';
      case 'OVER_101K_300K':
      case 'DOUBLE_DEPOSIT_MAX_500K':
        return '2 คน';
      case 'OVER_301K_500K':
        return '3 คน';
      case 'SELF_ONLY':
      default:
        return '-';
    }
  }

  function renderTermOptions(totalLoanAmount) {
    const allowed = getAllowedTerms(totalLoanAmount);
    const current = Number(elements.termMonths.value || 0);
    elements.termMonths.innerHTML = allowed
      .map((months) => `<option value="${months}">${formatTermLabel(months)}</option>`)
      .join('');
    if (allowed.includes(current)) {
      elements.termMonths.value = String(current);
    } else {
      elements.termMonths.value = String(allowed[allowed.length - 1]);
    }
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
      overDepositMode: elements.overDepositMode.value,
      termMonths: elements.termMonths.value,
      hasOldDebt: elements.hasOldDebt.checked,
      oldDebtRequested: elements.oldDebtRequested.value,
      oldDebtCurrent: elements.oldDebtCurrent.value,
      oldDebtInstallment: elements.oldDebtInstallment.value
    };
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getDraftData()));
    } catch (error) {
      console.warn('saveDraft failed', error);
    }
  }

  function restoreInputValue(input, value) {
    input.value = value || '';
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
      elements.overDepositMode.value = draft.overDepositMode || 'SELF_ONLY';
      elements.hasOldDebt.checked = Boolean(draft.hasOldDebt);
      restoreInputValue(elements.oldDebtRequested, draft.oldDebtRequested);
      restoreInputValue(elements.oldDebtCurrent, draft.oldDebtCurrent);
      restoreInputValue(elements.oldDebtInstallment, draft.oldDebtInstallment);
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
    const normalizedDeposit = normalizeDepositForLoan(rawDeposit);
    const overDepositMode = elements.overDepositMode.value;
    const overDepositAmount = computeOverDeposit(overDepositMode, rawDeposit);
    const totalLoanAmount = normalizedDeposit + overDepositAmount;

    renderTermOptions(totalLoanAmount);

    const termMonths = Number(elements.termMonths.value || 0);
    const monthlyInstallment = monthlyPayment(totalLoanAmount, ANNUAL_RATE, termMonths);

    const hasOldDebt = elements.hasOldDebt.checked;
    const oldDebtCurrent = hasOldDebt ? parseMoney(elements.oldDebtCurrent.value) : 0;
    const oldDebtInstallment = hasOldDebt ? parseMoney(elements.oldDebtInstallment.value) : 0;
    const differenceAmount = hasOldDebt ? totalLoanAmount - oldDebtCurrent : 0;

    const oneThirdAmount = totalIncome / 3;
    const remainingAfterLoan = remainingIncome - monthlyInstallment + oldDebtInstallment;
    const guarantorText = getGuarantorText(overDepositMode);

    elements.salaryAmount.value = formatMoney(salary);
    elements.latestMonth.value = getLatestMonthText();
    setComputedValue(elements.remainingIncome, remainingIncome);
    setComputedValue(elements.totalLoanAmount, totalLoanAmount);
    setComputedValue(elements.monthlyPayment, monthlyInstallment);
    setComputedValue(elements.differenceAmount, differenceAmount);
    setComputedValue(elements.oneThirdAmount, oneThirdAmount);
    setComputedValue(elements.remainingAfterLoan, remainingAfterLoan);
    elements.guarantorCount.value = isPristine ? '' : guarantorText;

    elements.oldDebtSection.classList.toggle('hidden', !hasOldDebt);
    updateStatusCard(remainingAfterLoan, oneThirdAmount);
    saveDraft();
  }

  function markDirtyAndRecalculate() {
    isPristine = false;
    recalculate();
  }

  function clearEditable(input) {
    input.value = '';
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
      elements.oldDebtRequested,
      elements.oldDebtCurrent,
      elements.oldDebtInstallment
    ].forEach(clearEditable);

    elements.overDepositMode.value = 'SELF_ONLY';
    elements.hasOldDebt.checked = false;
    elements.oldDebtSection.classList.add('hidden');
    elements.guarantorCount.value = '';
    [
      elements.remainingIncome,
      elements.totalLoanAmount,
      elements.monthlyPayment,
      elements.differenceAmount,
      elements.oneThirdAmount,
      elements.remainingAfterLoan
    ].forEach((input) => { input.value = ''; });

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
    elements.resetBtn.addEventListener('click', resetAll);

    [
      elements.totalIncome,
      elements.totalDeductions,
      elements.depositAmount,
      elements.oldDebtRequested,
      elements.oldDebtCurrent,
      elements.oldDebtInstallment
    ].forEach(bindMoneyInput);
  }

  function init() {
    populateLevels();
    populateOverDepositModes();
    elements.latestMonth.value = getLatestMonthText();
    const restored = loadDraft();
    if (!restored) {
      resetAll();
    }
    bindEvents();
  }

  init();
})();
