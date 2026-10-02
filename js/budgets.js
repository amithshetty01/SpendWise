/**
 * Budgets Module for SpendWise
 * Manages category budget limits, overall monthly limit, and budget health progress indicators.
 */

const BudgetsManager = {
  pendingDeleteCatId: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const setOverallBtn = document.getElementById('set-overall-budget-btn');
    const addCatBudgetBtn = document.getElementById('add-category-budget-btn');
    const emptyAddBtn = document.getElementById('empty-add-budget-btn');

    if (setOverallBtn) setOverallBtn.addEventListener('click', () => this.openOverallBudgetModal());
    if (addCatBudgetBtn) addCatBudgetBtn.addEventListener('click', () => this.openCategoryBudgetModal());
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => this.openCategoryBudgetModal());

    const overallForm = document.getElementById('form-overall-budget');
    if (overallForm) overallForm.addEventListener('submit', (e) => this.handleOverallBudgetSubmit(e));

    const budgetForm = document.getElementById('form-budget');
    if (budgetForm) budgetForm.addEventListener('submit', (e) => this.handleCategoryBudgetSubmit(e));
  },

  openOverallBudgetModal() {
    const overallBudget = StorageManager.getOverallBudget();
    document.getElementById('overall-budget-amount').value = overallBudget || '';
    Utils.openModal('modal-overall-budget');
  },

  handleOverallBudgetSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('overall-budget-amount').value) || 0;
    StorageManager.saveOverallBudget(amount);
    Utils.showToast('Overall monthly budget updated.', 'success');
    Utils.closeModal('modal-overall-budget');
    App.refreshAllViews();
  },

  openCategoryBudgetModal(catId = null) {
    const form = document.getElementById('form-budget');
    if (form) form.reset();

    const categories = StorageManager.getCategories().filter(c => c.type === 'expense');
    const select = document.getElementById('budget-category');

    if (select) {
      select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (catId) select.value = catId;
    }

    const budgets = StorageManager.getBudgets();
    if (catId && budgets[catId]) {
      document.getElementById('budget-amount').value = budgets[catId];
      document.getElementById('modal-budget-title').textContent = 'Edit Category Budget';
    } else {
      document.getElementById('modal-budget-title').textContent = 'Set Category Budget';
    }

    Utils.openModal('modal-budget');
  },

  handleCategoryBudgetSubmit(e) {
    e.preventDefault();
    const catId = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);

    if (isNaN(amount) || amount <= 0) {
      Utils.showToast('Please enter a budget amount greater than zero.', 'warning');
      return;
    }

    StorageManager.setCategoryBudget(catId, amount);
    Utils.showToast('Category budget saved!', 'success');
    Utils.closeModal('modal-budget');
    App.refreshAllViews();
  },

  deleteCategoryBudget(catId) {
    StorageManager.setCategoryBudget(catId, 0);
    Utils.showToast('Category budget removed.', 'info');
    App.refreshAllViews();
  },

  renderBudgetsView() {
    const budgets = StorageManager.getBudgets();
    const overallBudget = StorageManager.getOverallBudget();
    const categories = StorageManager.getCategories();
    const transactions = StorageManager.getTransactions();
    const settings = StorageManager.getSettings();

    // Compute expenses for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const currentMonthExpenses = transactions.filter(t => t.type === 'expense' && Utils.isInRange(t.date, startOfMonth, endOfMonth));

    // Calculate total spent in current month
    let totalSpent = 0;
    const catSpentMap = {};

    currentMonthExpenses.forEach(t => {
      totalSpent += t.amount;
      catSpentMap[t.category] = (catSpentMap[t.category] || 0) + t.amount;
    });

    // Update Overall Summary Card
    const remainingOverall = Math.max(0, overallBudget - totalSpent);
    document.getElementById('overall-budget-val').textContent = Utils.formatCurrency(overallBudget, settings.currency);
    document.getElementById('overall-spent-val').textContent = Utils.formatCurrency(totalSpent, settings.currency);
    document.getElementById('overall-remaining-val').textContent = Utils.formatCurrency(remainingOverall, settings.currency);

    // Render Budgets Grid
    const grid = document.getElementById('budgets-grid-container');
    const emptyState = document.getElementById('budgets-empty-state');
    const emptyCard = document.getElementById('budgets-empty-card');

    const budgetCategoryIds = Object.keys(budgets);

    if (budgetCategoryIds.length === 0) {
      if (grid) grid.innerHTML = '';
      if (emptyCard) emptyCard.style.display = 'block';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyCard) emptyCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = budgetCategoryIds.map(catId => {
      const limit = budgets[catId];
      const spent = catSpentMap[catId] || 0;
      const remaining = limit - spent;
      const percent = Math.min(100, Math.round((spent / limit) * 100));

      const cat = categories.find(c => c.id === catId) || { name: 'Uncategorized', icon: 'folder' };

      let statusClass = '';
      let fillClass = 'fill-good';
      let badgeHtml = '<span class="badge badge-income">On Track</span>';

      if (percent >= 100) {
        statusClass = 'exceeded';
        fillClass = 'fill-danger';
        badgeHtml = '<span class="badge badge-expense">Exceeded!</span>';
      } else if (percent >= 80) {
        statusClass = 'warning';
        fillClass = 'fill-warning';
        badgeHtml = '<span class="badge" style="background: var(--color-warning-bg); color: var(--color-warning)">Warning (80%+)</span>';
      }

      return `
        <div class="budget-card ${statusClass}">
          <div class="budget-card-header">
            <div class="budget-cat-info">
              <div class="budget-icon">
                <i data-lucide="${cat.icon || 'folder'}"></i>
              </div>
              <div>
                <h4>${cat.name}</h4>
                ${badgeHtml}
              </div>
            </div>
            <div>
              <button class="btn btn-icon btn-sm" onclick="BudgetsManager.openCategoryBudgetModal('${catId}')" title="Edit Budget">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn btn-icon btn-sm" onclick="BudgetsManager.deleteCategoryBudget('${catId}')" title="Delete Budget">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>

          <div class="budget-amounts">
            <span>Spent: <strong>${Utils.formatCurrency(spent, settings.currency)}</strong></span>
            <span>Limit: <strong>${Utils.formatCurrency(limit, settings.currency)}</strong></span>
          </div>

          <div class="budget-progress-outer">
            <div class="budget-progress-fill ${fillClass}" style="width: ${percent}%"></div>
          </div>

          <div class="budget-card-footer">
            <span>Remaining: <strong style="color: ${remaining < 0 ? 'var(--color-expense)' : 'var(--text-primary)'}">${Utils.formatCurrency(remaining, settings.currency)}</strong></span>
            <span>${percent}% Used</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }
};
