/**
 * Analytics Module for SpendWise
 * Calculates financial analytics, average daily spending, largest transaction, month-over-month comparison, and Chart.js graphics.
 */

const AnalyticsManager = {
  chartMom: null,
  chartCatDoughnut: null,
  chartDailyTrend: null,
  chartIncomeSources: null,

  init() {
    // Analytics view relies on global date range filter
  },

  renderAnalyticsView() {
    const allTransactions = StorageManager.getTransactions();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();

    const { startDate, endDate } = DashboardManager.getCurrentRangeDates();
    const transactions = allTransactions.filter(t => Utils.isInRange(t.date, startDate, endDate));

    // Calculate Summary Metrics
    const expenseTx = transactions.filter(t => t.type === 'expense');

    // 1. Average Daily Spending
    const totalExpenses = expenseTx.reduce((sum, t) => sum + t.amount, 0);
    const diffTime = Math.abs(endDate - startDate);
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const avgDaily = totalExpenses / totalDays;

    document.getElementById('analytics-avg-daily').textContent = Utils.formatCurrency(avgDaily, settings.currency);

    // 2. Largest Transaction
    let largestTx = null;
    let maxAmt = 0;
    transactions.forEach(t => {
      if (t.amount > maxAmt) {
        maxAmt = t.amount;
        largestTx = t;
      }
    });

    document.getElementById('analytics-largest-tx').textContent = Utils.formatCurrency(maxAmt, settings.currency);
    document.getElementById('analytics-largest-name').textContent = largestTx ? `${largestTx.title} (${largestTx.type})` : 'None';

    // 3. Most-Used Payment Method
    const methodCounts = {};
    transactions.forEach(t => {
      const m = t.paymentMethod || 'Cash';
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });

    let topMethod = 'None';
    let topMethodCount = 0;
    Object.keys(methodCounts).forEach(m => {
      if (methodCounts[m] > topMethodCount) {
        topMethodCount = methodCounts[m];
        topMethod = m;
      }
    });

    document.getElementById('analytics-top-method').textContent = topMethod;
    document.getElementById('analytics-top-method-sub').textContent = `${topMethodCount} transactions`;

    // 4. Month-over-Month Comparison
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    let curExp = 0;
    let prevExp = 0;

    allTransactions.filter(t => t.type === 'expense').forEach(t => {
      if (Utils.isInRange(t.date, currentMonthStart, now)) curExp += t.amount;
      if (Utils.isInRange(t.date, previousMonthStart, previousMonthEnd)) prevExp += t.amount;
    });

    let momPct = 0;
    if (prevExp > 0) {
      momPct = Math.round(((curExp - prevExp) / prevExp) * 100);
    }

    const momElem = document.getElementById('analytics-mom-change');
    const momSubElem = document.getElementById('analytics-mom-sub');

    momElem.textContent = `${momPct >= 0 ? '+' : ''}${momPct}%`;
    momElem.style.color = momPct > 0 ? 'var(--color-expense)' : 'var(--color-income)';
    momSubElem.textContent = `${Utils.formatCurrency(curExp, settings.currency)} vs ${Utils.formatCurrency(prevExp, settings.currency)} last mo`;

    // Render Charts
    this.render6MonthChart(allTransactions, settings);
    this.renderExpenseCategoryDoughnut(transactions, categories, settings);
    this.renderDailySpendingTrend(transactions, settings);
    this.renderIncomeSourcesDoughnut(transactions, categories, settings);
  },

  render6MonthChart(allTransactions, settings) {
    const ctx = document.getElementById('chart-analytics-mom')?.getContext('2d');
    if (!ctx) return;

    if (this.chartMom) this.chartMom.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Generate last 6 months labels
    const months = [];
    const incomeData = [];
    const expenseData = [];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months.push(monthName);

      let mInc = 0;
      let mExp = 0;

      allTransactions.forEach(t => {
        if (Utils.isInRange(t.date, mStart, mEnd)) {
          if (t.type === 'income') mInc += t.amount;
          else mExp += t.amount;
        }
      });

      incomeData.push(mInc);
      expenseData.push(mExp);
    }

    this.chartMom = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: isDark ? '#10b981' : '#059669',
            borderRadius: 4
          },
          {
            label: 'Expenses',
            data: expenseData,
            backgroundColor: isDark ? '#ef4444' : '#dc2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { color: textColor, font: { family: 'Inter', size: 11 } } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { color: gridColor } }
        }
      }
    });
  },

  renderExpenseCategoryDoughnut(transactions, categories, settings) {
    const ctx = document.getElementById('chart-analytics-cat-doughnut')?.getContext('2d');
    if (!ctx) return;

    if (this.chartCatDoughnut) this.chartCatDoughnut.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
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

    this.chartCatDoughnut = new Chart(ctx, {
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
          legend: { position: 'right', labels: { color: textColor, font: { family: 'Inter', size: 11 }, boxWidth: 10 } }
        }
      }
    });
  },

  renderDailySpendingTrend(transactions, settings) {
    const ctx = document.getElementById('chart-analytics-daily-trend')?.getContext('2d');
    if (!ctx) return;

    if (this.chartDailyTrend) this.chartDailyTrend.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const dateMap = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      dateMap[t.date] = (dateMap[t.date] || 0) + t.amount;
    });

    const sortedDates = Object.keys(dateMap).sort();
    const labels = sortedDates.map(d => Utils.formatDate(d, settings.dateFormat));
    const data = sortedDates.map(d => dateMap[d]);

    this.chartDailyTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Daily Expenses',
          data: data.length > 0 ? data : [0],
          borderColor: isDark ? '#10b981' : '#059669',
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(5, 150, 105, 0.06)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
          pointBackgroundColor: isDark ? '#10b981' : '#059669'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { family: 'Inter', size: 11 } }, grid: { color: gridColor } }
        }
      }
    });
  },

  renderIncomeSourcesDoughnut(transactions, categories, settings) {
    const ctx = document.getElementById('chart-analytics-income-sources')?.getContext('2d');
    if (!ctx) return;

    if (this.chartIncomeSources) this.chartIncomeSources.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const sourceTotals = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
      sourceTotals[t.category] = (sourceTotals[t.category] || 0) + t.amount;
    });

    const labels = [];
    const data = [];
    const colors = ['#059669', '#0284c7', '#d97706', '#8b5cf6', '#ec4899', '#14b8a6'];

    Object.keys(sourceTotals).forEach((catId, idx) => {
      const cat = categories.find(c => c.id === catId) || { name: 'Other Income' };
      labels.push(cat.name);
      data.push(sourceTotals[catId]);
    });

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
};
