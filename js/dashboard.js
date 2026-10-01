/**
 * Dashboard (Overview) Module for SpendWise
 * Calculates financial summary metrics, payment methods breakdown, income sources, and Chart.js analytics.
 */

const DashboardManager = {
  chartIncomeVsExpense: null,
  chartExpenseCategory: null,
  chartIncomeSources: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dateRangeSelect = document.getElementById('global-date-range');
    const customApplyBtn = document.getElementById('apply-custom-date');
    const editOpeningBtn = document.getElementById('edit-opening-balance-btn');
    const formOpening = document.getElementById('form-opening-balance');

    if (dateRangeSelect) {
      dateRangeSelect.addEventListener('change', (e) => {
        const customContainer = document.getElementById('custom-date-container');
        if (e.target.value === 'custom') {
          if (customContainer) customContainer.style.display = 'flex';
        } else {
          if (customContainer) customContainer.style.display = 'none';
          this.renderDashboard();
        }
      });
    }

    if (customApplyBtn) {
      customApplyBtn.addEventListener('click', () => {
        this.renderDashboard();
      });
    }

    if (editOpeningBtn) {
      editOpeningBtn.addEventListener('click', () => {
        const currentOpening = StorageManager.getOpeningBalance();
        document.getElementById('opening-balance-amount').value = currentOpening || 0;
        Utils.openModal('modal-opening-balance');
      });
    }

    if (formOpening) {
      formOpening.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('opening-balance-amount').value) || 0;
        StorageManager.saveOpeningBalance(amount);
        Utils.showToast('Opening balance updated.', 'success');
        Utils.closeModal('modal-opening-balance');
        App.refreshAllViews();
      });
    }
  },

  getCurrentRangeDates() {
    const rangeKey = document.getElementById('global-date-range')?.value || 'this-month';
    const customStart = document.getElementById('custom-start-date')?.value;
    const customEnd = document.getElementById('custom-end-date')?.value;
    return Utils.getRangeDates(rangeKey, customStart, customEnd);
  },

  renderDashboard() {
    const allTransactions = StorageManager.getTransactions();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();

    const { startDate, endDate } = this.getCurrentRangeDates();

    // Filter transactions by date range
    const filteredTx = allTransactions.filter(t => Utils.isInRange(t.date, startDate, endDate));

    // Calculate Selected Period Figures
    let periodIncome = 0;
    let periodExpense = 0;

    filteredTx.forEach(t => {
      if (t.type === 'income') {
        periodIncome += t.amount;
      } else if (t.type === 'expense') {
        periodExpense += t.amount;
      }
    });

    // All Time Cumulative Balance Calculation
    const openingBalance = StorageManager.getOpeningBalance();
    let totalAllTimeIncome = 0;
    let totalAllTimeExpense = 0;

    allTransactions.forEach(t => {
      if (t.type === 'income') totalAllTimeIncome += t.amount;
      else if (t.type === 'expense') totalAllTimeExpense += t.amount;
    });

    const totalAvailableBalance = openingBalance + totalAllTimeIncome - totalAllTimeExpense;
    const netSavings = periodIncome - periodExpense;
    const savingsRate = periodIncome > 0 ? Math.max(0, Math.round(((periodIncome - periodExpense) / periodIncome) * 1000) / 10) : 0;

    // Update DOM Metrics Cards
    document.getElementById('dash-total-balance').textContent = Utils.formatCurrency(totalAvailableBalance, settings.currency);
    document.getElementById('dash-total-income').textContent = Utils.formatCurrency(periodIncome, settings.currency);
    document.getElementById('dash-total-expense').textContent = Utils.formatCurrency(periodExpense, settings.currency);
    document.getElementById('dash-net-savings-val').textContent = Utils.formatCurrency(netSavings, settings.currency);
    document.getElementById('dash-savings-rate').textContent = `${savingsRate.toFixed(1)}%`;
    document.getElementById('dash-avail-balance-sub').textContent = Utils.formatCurrency(totalAvailableBalance, settings.currency);

    // Render Sub-Sections
    this.renderPaymentMethodsBreakdown(filteredTx, settings);
    this.renderIncomeSourcesBreakdown(filteredTx, categories, settings);
    this.renderExpenseCategoryChart(filteredTx, categories, settings);
    this.renderIncomeVsExpenseChart(filteredTx, settings);
    this.renderHighlights(filteredTx, categories, settings);
  },

  renderPaymentMethodsBreakdown(transactions, settings) {
    const container = document.getElementById('dash-payment-methods-container');
    if (!container) return;

    const methods = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Net Banking'];
    const methodTotals = {};
    methods.forEach(m => methodTotals[m] = { expense: 0, income: 0 });

    transactions.forEach(t => {
      const m = t.paymentMethod || 'Cash';
      if (!methodTotals[m]) methodTotals[m] = { expense: 0, income: 0 };
      if (t.type === 'expense') methodTotals[m].expense += t.amount;
      else methodTotals[m].income += t.amount;
    });

    const iconsMap = {
      'UPI': 'qr-code',
      'Cash': 'banknote',
      'Credit Card': 'credit-card',
      'Debit Card': 'credit-card',
      'Bank Transfer': 'building-2',
      'Net Banking': 'globe'
    };

    container.innerHTML = Object.keys(methodTotals).map(m => {
      const icon = iconsMap[m] || 'wallet';
      const expense = methodTotals[m].expense;
      const income = methodTotals[m].income;

      return `
        <div class="payment-method-card">
          <div class="pm-header">
            <div class="pm-icon"><i data-lucide="${icon}"></i></div>
            <span class="pm-name">${m}</span>
          </div>
          <div class="pm-body">
            <div class="pm-figure">
              <span class="pm-label">Expense</span>
              <strong class="pm-amount">${Utils.formatCurrency(expense, settings.currency)}</strong>
            </div>
            ${income > 0 ? `
              <div class="pm-figure text-success">
                <span class="pm-label">Income</span>
                <strong class="pm-amount">+${Utils.formatCurrency(income, settings.currency)}</strong>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  renderIncomeSourcesBreakdown(transactions, categories, settings) {
    const container = document.getElementById('dash-income-sources-list');
    const ctx = document.getElementById('chart-income-sources')?.getContext('2d');
    
    const incomeTx = transactions.filter(t => t.type === 'income');
    const sourceTotals = {};

    incomeTx.forEach(t => {
      sourceTotals[t.category] = (sourceTotals[t.category] || 0) + t.amount;
    });

    const labels = [];
    const data = [];
    const colors = ['#059669', '#0284c7', '#d97706', '#8b5cf6', '#ec4899', '#14b8a6'];

    Object.keys(sourceTotals).forEach((catId, idx) => {
      const cat = categories.find(c => c.id === catId) || { name: 'Other Income', color: colors[idx % colors.length] };
      labels.push(cat.name);
      data.push(sourceTotals[catId]);
    });

    // Render Doughnut Chart for Income
    if (ctx) {
      if (this.chartIncomeSources) this.chartIncomeSources.destroy();

      const isDark = settings.theme === 'dark';
      const textColor = isDark ? '#94a3b8' : '#64748b';

      this.chartIncomeSources = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels.length > 0 ? labels : ['No Income'],
          datasets: [{
            data: data.length > 0 ? data : [1],
            backgroundColor: colors.slice(0, Math.max(1, labels.length)),
            borderWidth: 1,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: textColor, font: { family: 'Inter', size: 11 }, boxWidth: 10 } }
          }
        }
      });
    }

    // Render Income List
    if (container) {
      if (Object.keys(sourceTotals).length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-2" style="font-size: 11.5px;">No income recorded for this period.</p>';
      } else {
        container.innerHTML = Object.keys(sourceTotals).map((catId, idx) => {
          const cat = categories.find(c => c.id === catId) || { name: 'Other Income' };
          const amt = sourceTotals[catId];
          return `
            <div class="income-source-row">
              <span><i data-lucide="${cat.icon || 'circle-dollar-sign'}"></i> ${cat.name}</span>
              <strong class="amount-display text-success">+${Utils.formatCurrency(amt, settings.currency)}</strong>
            </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  },

  renderExpenseCategoryChart(transactions, categories, settings) {
    const ctx = document.getElementById('chart-expense-category')?.getContext('2d');
    if (!ctx) return;

    if (this.chartExpenseCategory) this.chartExpenseCategory.destroy();

    const isDark = settings.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const catTotals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    const labels = [];
    const data = [];
    const colors = [];

    const fallbackColors = ['#059669', '#0284c7', '#d97706', '#dc2626', '#4f46e5', '#8b5cf6', '#14b8a6', '#64748b'];

    Object.keys(catTotals).forEach((catId, idx) => {
      const cat = categories.find(c => c.id === catId) || { name: 'Other', color: fallbackColors[idx % fallbackColors.length] };
      labels.push(cat.name);
      data.push(catTotals[catId]);
      colors.push(cat.color || fallbackColors[idx % fallbackColors.length]);
    });

    this.chartExpenseCategory = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Expenses'],
        datasets: [{
          data: data.length > 0 ? data : [1],
          backgroundColor: colors.length > 0 ? colors : ['#334155'],
          borderWidth: 1,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'right', 
            labels: { color: textColor, font: { family: 'Inter', size: 11 }, boxWidth: 10 } 
          }
        }
      }
    });
  },

  renderIncomeVsExpenseChart(transactions, settings) {
    const ctx = document.getElementById('chart-income-vs-expense')?.getContext('2d');
    if (!ctx) return;

    if (this.chartIncomeVsExpense) this.chartIncomeVsExpense.destroy();

    const isDark = settings.theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const dateMap = {};
    transactions.forEach(t => {
      const dateKey = t.date;
      if (!dateMap[dateKey]) dateMap[dateKey] = { income: 0, expense: 0 };
      if (t.type === 'income') dateMap[dateKey].income += t.amount;
      else dateMap[dateKey].expense += t.amount;
    });

    const sortedDates = Object.keys(dateMap).sort();
    const labels = sortedDates.map(d => Utils.formatDate(d, settings.dateFormat));
    const incomeData = sortedDates.map(d => dateMap[d].income);
    const expenseData = sortedDates.map(d => dateMap[d].expense);

    this.chartIncomeVsExpense = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Income',
            data: incomeData.length > 0 ? incomeData : [0],
            backgroundColor: isDark ? '#10b981' : '#059669',
            borderRadius: 4
          },
          {
            label: 'Expenses',
            data: expenseData.length > 0 ? expenseData : [0],
            backgroundColor: isDark ? '#ef4444' : '#dc2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'top', 
            align: 'end',
            labels: { color: textColor, font: { family: 'Inter', size: 11 }, boxWidth: 10 } 
          }
        },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { color: gridColor } }
        }
      }
    });
  },

  renderHighlights(transactions, categories, settings) {
    const categoryTotals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    let topCatId = null;
    let maxAmount = 0;
    Object.keys(categoryTotals).forEach(catId => {
      if (categoryTotals[catId] > maxAmount) {
        maxAmount = categoryTotals[catId];
        topCatId = catId;
      }
    });

    const topCatNameElem = document.getElementById('dash-highest-cat-name');
    const topCatAmountElem = document.getElementById('dash-highest-cat-amount');

    if (topCatId) {
      const cat = categories.find(c => c.id === topCatId) || { name: 'Uncategorized' };
      topCatNameElem.textContent = cat.name;
      topCatAmountElem.textContent = Utils.formatCurrency(maxAmount, settings.currency);
    } else {
      topCatNameElem.textContent = 'None';
      topCatAmountElem.textContent = Utils.formatCurrency(0, settings.currency);
    }
  }
};
