/**
 * Calendar Module for SpendWise
 * Renders an interactive monthly calendar with daily income & expense tags.
 */

const CalendarManager = {
  currentDate: new Date(),
  selectedDayStr: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    const todayBtn = document.getElementById('cal-today-btn');

    if (prevBtn) prevBtn.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendarView();
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendarView();
    });

    if (todayBtn) todayBtn.addEventListener('click', () => {
      this.currentDate = new Date();
      this.renderCalendarView();
    });

    const addDayTxBtn = document.getElementById('cal-day-add-tx-btn');
    if (addDayTxBtn) {
      addDayTxBtn.addEventListener('click', () => {
        Utils.closeModal('modal-calendar-day');
        TransactionsManager.openAddTransactionModal(this.selectedDayStr);
      });
    }
  },

  renderCalendarView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    document.getElementById('cal-month-year-title').textContent = `${monthNames[month]} ${year}`;

    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const firstDayIndex = new Date(year, month, 1).getDay(); // Day of week
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const transactions = StorageManager.getTransactions();
    const settings = StorageManager.getSettings();
    const todayStr = new Date().toISOString().split('T')[0];

    // Map transactions by YYYY-MM-DD
    const txMap = {};
    transactions.forEach(t => {
      if (!txMap[t.date]) txMap[t.date] = { income: 0, expense: 0, items: [] };
      if (t.type === 'income') txMap[t.date].income += t.amount;
      else txMap[t.date].expense += t.amount;
      txMap[t.date].items.push(t);
    });

    // Render Previous Month Padding Days
    for (let x = firstDayIndex; x > 0; x--) {
      const dayNum = prevMonthDays - x + 1;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `<span class="cal-day-number">${dayNum}</span>`;
      grid.appendChild(cell);
    }

    // Render Current Month Days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayData = txMap[dayStr];

      const cell = document.createElement('div');
      cell.className = `cal-day-cell ${dayStr === todayStr ? 'today' : ''}`;
      cell.onclick = () => this.openDayDetailsModal(dayStr, dayData);

      let badgesHtml = '';
      if (dayData) {
        if (dayData.income > 0) {
          badgesHtml += `<div class="cal-badge income">+${Utils.formatCurrency(dayData.income, settings.currency)}</div>`;
        }
        if (dayData.expense > 0) {
          badgesHtml += `<div class="cal-badge expense">-${Utils.formatCurrency(dayData.expense, settings.currency)}</div>`;
        }
      }

      cell.innerHTML = `
        <span class="cal-day-number">${i}</span>
        <div class="cal-day-badges">${badgesHtml}</div>
      `;

      grid.appendChild(cell);
    }

    // Render Next Month Padding Days to complete 35/42 grid
    const totalCellsSoFar = firstDayIndex + totalDaysInMonth;
    const remainingCells = (totalCellsSoFar > 35 ? 42 : 35) - totalCellsSoFar;

    for (let j = 1; j <= remainingCells; j++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `<span class="cal-day-number">${j}</span>`;
      grid.appendChild(cell);
    }
  },

  openDayDetailsModal(dayStr, dayData) {
    this.selectedDayStr = dayStr;
    const settings = StorageManager.getSettings();
    const categories = StorageManager.getCategories();

    document.getElementById('cal-day-modal-title').textContent = `Transactions on ${Utils.formatDate(dayStr, settings.dateFormat)}`;
    document.getElementById('cal-day-income').textContent = Utils.formatCurrency(dayData ? dayData.income : 0, settings.currency);
    document.getElementById('cal-day-expense').textContent = Utils.formatCurrency(dayData ? dayData.expense : 0, settings.currency);

    const listContainer = document.getElementById('cal-day-tx-list');
    if (listContainer) {
      if (!dayData || dayData.items.length === 0) {
        listContainer.innerHTML = '<p class="text-secondary text-center py-4">No transactions recorded on this day.</p>';
      } else {
        listContainer.innerHTML = dayData.items.map(t => {
          const cat = categories.find(c => c.id === t.category) || { name: 'Uncategorized', icon: 'folder' };
          return `
            <div class="insight-item mb-2" onclick="Utils.closeModal('modal-calendar-day'); TransactionsManager.viewTransactionDetails('${t.id}')" style="cursor: pointer;">
              <div class="tx-icon-badge ${t.type}">
                <i data-lucide="${cat.icon || 'folder'}"></i>
              </div>
              <div class="insight-info flex-1">
                <h4>${t.title}</h4>
                <span class="insight-sub">${cat.name} • ${t.paymentMethod}</span>
              </div>
              <div class="amount-display ${t.type}">
                ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount, settings.currency)}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
    Utils.openModal('modal-calendar-day');
  }
};
