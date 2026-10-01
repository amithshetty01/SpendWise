/**
 * Reports & Analytics Module for SpendWise
 * Generates financial reports, breakdowns, CSV export files, and print stylesheets.
 */

const ReportsManager = {
  chartCategoryBar: null,
  chartPaymentMethod: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const exportTxBtn = document.getElementById('export-tx-csv-btn');
    const exportSummaryBtn = document.getElementById('export-summary-csv-btn');
    const printBtn = document.getElementById('print-report-btn');

    if (exportTxBtn) exportTxBtn.addEventListener('click', () => this.exportTransactionsCSV());
    if (exportSummaryBtn) exportSummaryBtn.addEventListener('click', () => this.exportSummaryCSV());
    if (printBtn) printBtn.addEventListener('click', () => this.printReport());
  },

  renderReportsView() {
    const allTransactions = StorageManager.getTransactions();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();

    const { startDate, endDate } = DashboardManager.getCurrentRangeDates();
    const transactions = allTransactions.filter(t => Utils.isInRange(t.date, startDate, endDate));

    // Summary Figures
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += t.amount;
      else if (t.type === 'expense') totalExpense += t.amount;
    });

    const netSurplus = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10) : 0;

    document.getElementById('report-total-income').textContent = Utils.formatCurrency(totalIncome, settings.currency);
    document.getElementById('report-total-expense').textContent = Utils.formatCurrency(totalExpense, settings.currency);
    document.getElementById('report-net-surplus').textContent = Utils.formatCurrency(netSurplus, settings.currency);
    document.getElementById('report-savings-rate').textContent = `${savingsRate.toFixed(1)}%`;

    // Print metadata
    const periodText = document.getElementById('global-date-range')?.selectedOptions[0]?.text || 'This Month';
    document.getElementById('print-report-period').textContent = `Report Period: ${periodText}`;
    document.getElementById('print-generated-at').textContent = `Generated on: ${new Date().toLocaleString()}`;

    // Render Charts & Table
    this.renderCategoryBarChart(transactions, categories, settings);
    this.renderPaymentMethodChart(transactions, settings);
    this.renderTopCategoriesTable(transactions, categories, settings, totalExpense);
  },

  renderCategoryBarChart(transactions, categories, settings) {
    const ctx = document.getElementById('chart-reports-category-bar')?.getContext('2d');
    if (!ctx) return;

    if (this.chartCategoryBar) this.chartCategoryBar.destroy();

    const isDark = settings.theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
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

    this.chartCategoryBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Total Expenses',
          data: data.length > 0 ? data : [0],
          backgroundColor: colors.length > 0 ? colors : ['#334155'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { color: gridColor } }
        }
      }
    });
  },

  renderPaymentMethodChart(transactions, settings) {
    const ctx = document.getElementById('chart-reports-payment-method')?.getContext('2d');
    if (!ctx) return;

    if (this.chartPaymentMethod) this.chartPaymentMethod.destroy();

    const isDark = settings.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const methodTotals = {};
    transactions.forEach(t => {
      const m = t.paymentMethod || 'Cash';
      methodTotals[m] = (methodTotals[m] || 0) + t.amount;
    });

    const labels = Object.keys(methodTotals);
    const data = Object.values(methodTotals);
    const colors = ['#059669', '#0284c7', '#d97706', '#4f46e5', '#14b8a6', '#8b5cf6'];

    this.chartPaymentMethod = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
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
  },

  renderTopCategoriesTable(transactions, categories, settings, totalExpense) {
    const tableBody = document.getElementById('report-top-categories-table');
    if (!tableBody) return;

    const catStats = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      if (!catStats[t.category]) catStats[t.category] = { count: 0, amount: 0 };
      catStats[t.category].count++;
      catStats[t.category].amount += t.amount;
    });

    const sortedCats = Object.keys(catStats).sort((a, b) => catStats[b].amount - catStats[a].amount);

    if (sortedCats.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No expense transactions recorded in this period.</td></tr>';
      return;
    }

    tableBody.innerHTML = sortedCats.map(catId => {
      const cat = categories.find(c => c.id === catId) || { name: 'Uncategorized', icon: 'folder' };
      const stat = catStats[catId];
      const percent = totalExpense > 0 ? Math.round((stat.amount / totalExpense) * 1000) / 10 : 0;

      return `
        <tr>
          <td>
            <div class="tx-title-wrapper">
              <div class="tx-icon-badge" style="background: ${cat.color}15; color: ${cat.color}">
                <i data-lucide="${cat.icon || 'folder'}"></i>
              </div>
              <strong>${cat.name}</strong>
            </div>
          </td>
          <td>${stat.count} txns</td>
          <td class="amount-display"><strong>${Utils.formatCurrency(stat.amount, settings.currency)}</strong></td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <span class="amount-display">${percent}%</span>
              <div class="progress-bar-sm" style="width: 80px; display: inline-block; vertical-align: middle; margin-left: 8px;">
                <div class="progress-fill" style="width: ${percent}%; background-color: ${cat.color || '#059669'}"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  exportTransactionsCSV() {
    const allTransactions = StorageManager.getTransactions();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();
    const { startDate, endDate } = DashboardManager.getCurrentRangeDates();

    const transactions = allTransactions.filter(t => Utils.isInRange(t.date, startDate, endDate));

    const rows = [
      ['Transaction ID', 'Title', 'Type', 'Category', 'Amount', 'Currency', 'Payment Method', 'Date', 'Notes']
    ];

    transactions.forEach(t => {
      const cat = categories.find(c => c.id === t.category) || { name: 'Uncategorized' };
      rows.push([
        t.id,
        t.title,
        t.type,
        cat.name,
        t.amount,
        settings.currency,
        t.paymentMethod || 'Cash',
        t.date,
        t.notes || ''
      ]);
    });

    Utils.exportToCSV(`SpendWise_Transactions_${new Date().toISOString().split('T')[0]}.csv`, rows);
  },

  exportSummaryCSV() {
    const allTransactions = StorageManager.getTransactions();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();
    const { startDate, endDate } = DashboardManager.getCurrentRangeDates();

    const transactions = allTransactions.filter(t => Utils.isInRange(t.date, startDate, endDate));

    let totalIncome = 0;
    let totalExpense = 0;
    const catExpenses = {};

    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += t.amount;
      else if (t.type === 'expense') {
        totalExpense += t.amount;
        catExpenses[t.category] = (catExpenses[t.category] || 0) + t.amount;
      }
    });

    const netSurplus = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    const rows = [
      ['SpendWise Financial Summary Report'],
      ['Generated At', new Date().toLocaleString()],
      ['Currency', settings.currency],
      [],
      ['Metric', 'Value'],
      ['Total Revenue / Income', totalIncome],
      ['Total Expenses', totalExpense],
      ['Net Surplus / Deficit', netSurplus],
      ['Savings Rate (%)', `${savingsRate.toFixed(2)}%`],
      [],
      ['Expense Category Breakdown'],
      ['Category Name', 'Total Amount Spent', 'Percentage of Expense']
    ];

    Object.keys(catExpenses).forEach(catId => {
      const cat = categories.find(c => c.id === catId) || { name: 'Uncategorized' };
      const amount = catExpenses[catId];
      const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      rows.push([cat.name, amount, `${pct.toFixed(2)}%`]);
    });

    Utils.exportToCSV(`SpendWise_Financial_Summary_${new Date().toISOString().split('T')[0]}.csv`, rows);
  },

  printReport() {
    window.print();
  }
};
