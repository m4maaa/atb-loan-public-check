(function () {
  const ANNUAL_RATE = 4.75;
  const LEVELS = ['ป.1', 'ป.2', 'ป.3', 'น.1', 'น.2', 'น.3'];
  const OVER_DEPOSIT_OPTIONS = [
    { value: 'SELF_ONLY', label: 'กู้เฉพาะเงินตัวเอง' },
    { value: 'OVER_1K_100K', label: 'เกินเงินฝากตั้งแต่ 1,000 - 100,000 บาท' },
    { value: 'OVER_101K_300K', label: 'เกินเงินฝากตั้งแต่ 101,000 - 300,000 บาท' },
    { value: 'OVER_301K_500K', label: 'เกินเงินฝากตั้งแต่ 301,000 - 500,000 บาท' },
    { value: 'DOUBLE_DEPOSIT_MAX_500K', label: '2 เท่าของเงินฝาก แต่ไม่เกิน 500,000 บาท' }
  ];

  const elements = {
    appCard: document.getElementById('appCard'),
    resetBtn: document.getElementById('resetBtn'),
    salaryLevel: document.getElementById('salaryLevel'),
    salaryStep: document.getElementById('salaryStep'),
    salaryAmount: document.getElementById('salaryAmount'),
    totalIncome: document.getElementById('totalIncome'),
    totalDeductions: document.getElementById('totalDeductions'),
    remainingIncome: document.getElementById('remainingIncome'),
    depositAmount: document.getElementById('depositAmount'),
    overDepositMode: document.getElementById('overDepositMode'),
    overDepositAmount: document.getElementById('overDepositAmount'),
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
    const num = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(num);
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? '')
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function setMoneyValue(input, value) {
    input.value = formatMoney(value);
  }

  function bindMoneyInput(input) {
    input.addEventListener('focus', () => {
      input.value = String(parseMoney(input.value) || 0);
    });

    input.addEventListener('blur', () => {
      setMoneyValue(input, parseMoney(input.value));
      markDirtyAndRecalculate();
    });

    input.addEventListener('input', markDirtyAndRecalculate);
  }

  function monthlyPayment(principal, annualRate, months) {
    const p = parseMoney(principal);
    const n = Number(months);

    if (p <= 0 || n <= 0) return 0;

    const r = annualRate / 100 / 12;
    if (r === 0) return p / n;

    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  function populateLevels() {
    elements.salaryLevel.innerHTML = LEVELS
      .map((level) => '<option value="' + level + '">' + level + '</option>')
      .join('');
  }

  function populateOverDepositModes() {
    elements.overDepositMode.innerHTML = OVER_DEPOSIT_OPTIONS
      .map((opt) => '<option value="' + opt.value + '">' + opt.label + '</option>')
      .join('');
  }

  function populateSteps(level, preferredStep) {
    const levelData = (window.SALARY_DATA || {})[level] || {};
    const steps = Object.keys(levelData);

    elements.salaryStep.innerHTML = steps
      .map((step) => '<option value="' + step + '">' + step + '</option>')
      .join('');

    if (preferredStep && steps.includes(preferredStep)) {
      elements.salaryStep.value = preferredStep;
    }
  }

  function getSalary(level, step) {
    const value = window.SALARY_DATA?.[level]?.[step];
    return Number.isFinite(value) ? value : 0;
  }

  function computeOverDeposit(mode, deposit) {
    switch (mode) {
      case 'SELF_ONLY':
        return 0;
      case 'OVER_1K_100K':
        return 100000;
      case 'OVER_101K_300K':
        return 300000;
      case 'OVER_301K_500K':
        return 500000;
      case 'DOUBLE_DEPOSIT_MAX_500K':
        return Math.min(parseMoney(deposit), 500000);
      default:
        return 0;
    }
  }

  function getGuarantorText(mode) {
    switch (mode) {
      case 'SELF_ONLY':
        return '-';
      case 'OVER_1K_100K':
        return '1 คน';
      case 'OVER_101K_300K':
        return '2 คน';
      case 'OVER_301K_500K':
        return '3 คน';
      case 'DOUBLE_DEPOSIT_MAX_500K':
        return '2 คน';
      default:
        return '-';
    }
  }

  function getAllowedTerms(totalLoan) {
    const amount = parseMoney(totalLoan);
    if (amount <= 0) return [24, 48];
    if (amount < 150000) return [24, 48];
    if (amount <= 290000) return [48, 60, 72, 84, 96];
    return [48, 60, 72, 84, 96, 120];
  }

  function renderTermOptions(totalLoan) {
    const allowed = getAllowedTerms(totalLoan);
    const current = Number(elements.termMonths.value);

    elements.termMonths.innerHTML = allowed
      .map((months) => '<option value="' + months + '">' + months + ' งวด / ' + (months / 12) + ' ปี</option>')
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

  function recalculate() {
    const level = elements.salaryLevel.value;
    const step = elements.salaryStep.value;
    const salary = getSalary(level, step);

    const totalIncome = parseMoney(elements.totalIncome.value);
    const totalDeductions = parseMoney(elements.totalDeductions.value);
    const remainingIncome = totalIncome - totalDeductions;

    const depositAmount = parseMoney(elements.depositAmount.value);
    const overDepositMode = elements.overDepositMode.value;
    const overDepositAmount = computeOverDeposit(overDepositMode, depositAmount);
    const totalLoanAmount = depositAmount + overDepositAmount;

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

    setMoneyValue(elements.salaryAmount, salary);
    setMoneyValue(elements.remainingIncome, remainingIncome);
    setMoneyValue(elements.overDepositAmount, overDepositAmount);
    setMoneyValue(elements.totalLoanAmount, totalLoanAmount);
    setMoneyValue(elements.monthlyPayment, monthlyInstallment);
    setMoneyValue(elements.differenceAmount, differenceAmount);
    setMoneyValue(elements.oneThirdAmount, oneThirdAmount);
    setMoneyValue(elements.remainingAfterLoan, remainingAfterLoan);
    elements.guarantorCount.value = guarantorText;

    elements.oldDebtSection.classList.toggle('hidden', !hasOldDebt);

    updateStatusCard(remainingAfterLoan, oneThirdAmount);
  }

  function markDirtyAndRecalculate() {
    isPristine = false;
    recalculate();
  }

  function resetAll() {
    isPristine = true;

    elements.salaryLevel.value = LEVELS[0];
    populateSteps(LEVELS[0], Object.keys((window.SALARY_DATA || {})[LEVELS[0]] || {})[0]);

    [
      elements.totalIncome,
      elements.totalDeductions,
      elements.depositAmount,
      elements.oldDebtRequested,
      elements.oldDebtCurrent,
      elements.oldDebtInstallment
    ].forEach((input) => setMoneyValue(input, 0));

    elements.overDepositMode.value = 'SELF_ONLY';
    elements.hasOldDebt.checked = false;

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
    populateSteps(LEVELS[0]);
    bindEvents();
    resetAll();
  }

  init();
})();