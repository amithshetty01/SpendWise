/**
 * Savings Goals Module for SpendWise
 * Allows creating, editing, and tracking savings goals and contributions.
 */

const GoalsManager = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    const addGoalBtn = document.getElementById('open-add-goal-btn');
    const emptyAddBtn = document.getElementById('empty-add-goal-btn');

    if (addGoalBtn) addGoalBtn.addEventListener('click', () => this.openGoalModal());
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => this.openGoalModal());

    const goalForm = document.getElementById('form-goal');
    if (goalForm) goalForm.addEventListener('submit', (e) => this.handleGoalFormSubmit(e));

    const contribForm = document.getElementById('form-goal-contribution');
    if (contribForm) contribForm.addEventListener('submit', (e) => this.handleContributionSubmit(e));
  },

  openGoalModal(goalId = null) {
    const form = document.getElementById('form-goal');
    if (form) form.reset();

    if (goalId) {
      const goals = StorageManager.getGoals();
      const g = goals.find(item => item.id === goalId);
      if (g) {
        document.getElementById('modal-goal-title').textContent = 'Edit Savings Goal';
        document.getElementById('goal-id').value = g.id;
        document.getElementById('goal-title').value = g.title;
        document.getElementById('goal-target-amount').value = g.targetAmount;
        document.getElementById('goal-current-amount').value = g.currentAmount || 0;
        document.getElementById('goal-target-date').value = g.targetDate;
        document.getElementById('goal-description').value = g.description || '';
      }
    } else {
      document.getElementById('modal-goal-title').textContent = 'Create Savings Goal';
      document.getElementById('goal-id').value = '';
    }

    Utils.openModal('modal-goal');
  },

  handleGoalFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('goal-id').value;
    const title = document.getElementById('goal-title').value.trim();
    const targetAmount = parseFloat(document.getElementById('goal-target-amount').value);
    const currentAmount = parseFloat(document.getElementById('goal-current-amount').value) || 0;
    const targetDate = document.getElementById('goal-target-date').value;
    const description = document.getElementById('goal-description').value.trim();

    if (!title) {
      Utils.showToast('Please enter a goal title.', 'warning');
      return;
    }
    if (isNaN(targetAmount) || targetAmount <= 0) {
      Utils.showToast('Target amount must be a positive number.', 'warning');
      return;
    }
    if (!targetDate) {
      Utils.showToast('Please select a target date.', 'warning');
      return;
    }

    const goalData = {
      id: id || Utils.generateId('goal'),
      title,
      targetAmount,
      currentAmount,
      targetDate,
      description,
      contributions: id ? (StorageManager.getGoals().find(g => g.id === id)?.contributions || []) : []
    };

    if (id) {
      StorageManager.updateGoal(goalData);
      Utils.showToast('Savings goal updated.', 'success');
    } else {
      StorageManager.addGoal(goalData);
      Utils.showToast('New savings goal created!', 'success');
    }

    Utils.closeModal('modal-goal');
    App.refreshAllViews();
  },

  openContributionModal(goalId) {
    const goals = StorageManager.getGoals();
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('contrib-goal-id').value = goal.id;
    document.getElementById('contrib-goal-name').textContent = `Goal: ${goal.title}`;
    document.getElementById('contrib-amount').value = '';
    document.getElementById('contrib-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('contrib-note').value = '';

    Utils.openModal('modal-goal-contribution');
  },

  handleContributionSubmit(e) {
    e.preventDefault();

    const goalId = document.getElementById('contrib-goal-id').value;
    const amount = parseFloat(document.getElementById('contrib-amount').value);
    const date = document.getElementById('contrib-date').value;
    const note = document.getElementById('contrib-note').value.trim();

    if (isNaN(amount) || amount <= 0) {
      Utils.showToast('Contribution amount must be greater than 0.', 'warning');
      return;
    }

    const goals = StorageManager.getGoals();
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    goal.currentAmount = (goal.currentAmount || 0) + amount;
    if (!goal.contributions) goal.contributions = [];
    goal.contributions.push({ id: Utils.generateId('cb'), amount, date, note });

    StorageManager.updateGoal(goal);
    Utils.showToast(`Added contribution of ₹${amount.toLocaleString()} to "${goal.title}"!`, 'success');

    Utils.closeModal('modal-goal-contribution');
    App.refreshAllViews();
  },

  deleteGoal(goalId) {
    document.getElementById('confirm-modal-title').textContent = 'Delete Savings Goal';
    document.getElementById('confirm-modal-message').textContent = 'Are you sure you want to delete this savings goal?';

    const confirmBtn = document.getElementById('confirm-btn-action');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        StorageManager.deleteGoal(goalId);
        Utils.showToast('Savings goal deleted.', 'info');
        Utils.closeModal('modal-confirm');
        App.refreshAllViews();
      };
    }

    Utils.openModal('modal-confirm');
  },

  renderGoalsView() {
    const goals = StorageManager.getGoals();
    const settings = StorageManager.getSettings();

    const grid = document.getElementById('goals-grid-container');
    const emptyState = document.getElementById('goals-empty-state');

    if (goals.length === 0) {
      if (grid) grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = goals.map(g => {
      const current = g.currentAmount || 0;
      const target = g.targetAmount;
      const remaining = Math.max(0, target - current);
      const percent = Math.min(100, Math.round((current / target) * 100));
      const isCompleted = current >= target;

      return `
        <div class="goal-card ${isCompleted ? 'completed' : ''}">
          <div class="goal-header">
            <div>
              <h3 class="goal-title">${g.title}</h3>
              ${isCompleted ? '<span class="badge badge-income"><i data-lucide="check-circle-2"></i> Goal Achieved! 🎉</span>' : `<span class="badge badge-method">Target: ${Utils.formatDate(g.targetDate, settings.dateFormat)}</span>`}
            </div>
            <div>
              <button class="btn btn-icon btn-sm" onclick="GoalsManager.openGoalModal('${g.id}')" title="Edit Goal">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn btn-icon btn-sm" onclick="GoalsManager.deleteGoal('${g.id}')" title="Delete Goal">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>

          <p class="text-secondary text-sm">${g.description || 'No notes provided.'}</p>

          <div class="goal-meta">
            <span>Saved: <strong>${Utils.formatCurrency(current, settings.currency)}</strong></span>
            <span>Target: <strong>${Utils.formatCurrency(target, settings.currency)}</strong></span>
          </div>

          <div class="progress-bar-sm">
            <div class="progress-fill" style="width: ${percent}%; background: ${isCompleted ? 'var(--color-income)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'}"></div>
          </div>

          <div class="goal-actions">
            <span class="text-xs text-muted">${percent}% Completed (${Utils.formatCurrency(remaining, settings.currency)} to go)</span>
            <button class="btn btn-sm btn-outline" onclick="GoalsManager.openContributionModal('${g.id}')" ${isCompleted ? 'disabled' : ''}>
              <i data-lucide="plus"></i> Add Money
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }
};
