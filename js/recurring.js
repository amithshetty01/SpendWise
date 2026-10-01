/**
 * Recurring Transactions Module for SpendWise
 * Configures scheduled income/expenses and processes due occurrences automatically.
 */

const RecurringManager = {
  init() {
    this.bindEvents();
    this.processRecurringRules();
  },

  bindEvents() {
    const addBtn = document.getElementById('open-add-recurring-btn');
    const emptyAddBtn = document.getElementById('empty-add-recurring-btn');

    if (addBtn) addBtn.addEventListener('click', () => this.openRecurringModal());
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => this.openRecurringModal());

    const form = document.getElementById('form-recurring');
    if (form) form.addEventListener('submit', (e) => this.handleRecurringSubmit(e));

    const typeSelect = document.getElementById('recurring-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.populateCategoryDropdown(e.target.value);
      });
    }
  },

  populateCategoryDropdown(type, selectedId = null) {
    const categories = StorageManager.getCategories().filter(c => c.type === type);
    const select = document.getElementById('recurring-category');
    if (select) {
      select.innerHTML = categories.map(c => `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    }
  },

  openRecurringModal(recId = null) {
    const form = document.getElementById('form-recurring');
    if (form) form.reset();

    if (recId) {
      const recurring = StorageManager.getRecurring();
      const r = recurring.find(item => item.id === recId);
      if (r) {
        document.getElementById('modal-recurring-title').textContent = 'Edit Recurring Rule';
        document.getElementById('recurring-id').value = r.id;
        document.getElementById('recurring-type').value = r.type;
        document.getElementById('recurring-amount').value = r.amount;
        document.getElementById('recurring-title').value = r.title;
        document.getElementById('recurring-frequency').value = r.frequency;
        document.getElementById('recurring-start-date').value = r.startDate;
        document.getElementById('recurring-method').value = r.paymentMethod || 'Cash';
        this.populateCategoryDropdown(r.type, r.category);
      }
    } else {
      document.getElementById('modal-recurring-title').textContent = 'Add Recurring Rule';
      document.getElementById('recurring-id').value = '';
      document.getElementById('recurring-start-date').value = new Date().toISOString().split('T')[0];
      this.populateCategoryDropdown('expense');
    }

    Utils.openModal('modal-recurring');
  },

  handleRecurringSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('recurring-id').value;
    const type = document.getElementById('recurring-type').value;
    const amount = parseFloat(document.getElementById('recurring-amount').value);
    const title = document.getElementById('recurring-title').value.trim();
    const frequency = document.getElementById('recurring-frequency').value;
    const category = document.getElementById('recurring-category').value;
    const startDate = document.getElementById('recurring-start-date').value;
    const paymentMethod = document.getElementById('recurring-method').value;

    if (!title || isNaN(amount) || amount <= 0 || !startDate) {
      Utils.showToast('Please fill in all required fields accurately.', 'warning');
      return;
    }

    const rule = {
      id: id || Utils.generateId('rec'),
      title,
      amount,
      type,
      category,
      frequency,
      startDate,
      nextDate: id ? (StorageManager.getRecurring().find(r => r.id === id)?.nextDate || startDate) : startDate,
      lastProcessedDate: id ? (StorageManager.getRecurring().find(r => r.id === id)?.lastProcessedDate || null) : null,
      paymentMethod,
      active: true
    };

    if (id) {
      StorageManager.updateRecurring(rule);
      Utils.showToast('Recurring rule updated.', 'success');
    } else {
      StorageManager.addRecurring(rule);
      Utils.showToast('New recurring rule created.', 'success');
    }

    Utils.closeModal('modal-recurring');
    this.processRecurringRules();
    App.refreshAllViews();
  },

  toggleRecurringActive(recId) {
    const recurring = StorageManager.getRecurring();
    const r = recurring.find(item => item.id === recId);
    if (!r) return;

    r.active = !r.active;
    StorageManager.updateRecurring(r);
    Utils.showToast(`Recurring rule ${r.active ? 'activated' : 'paused'}.`, 'info');
    App.refreshAllViews();
  },

  deleteRecurring(recId) {
    document.getElementById('confirm-modal-title').textContent = 'Delete Recurring Rule';
    document.getElementById('confirm-modal-message').textContent = 'Are you sure you want to delete this recurring transaction rule?';

    const confirmBtn = document.getElementById('confirm-btn-action');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        StorageManager.deleteRecurring(recId);
        Utils.showToast('Recurring rule deleted.', 'info');
        Utils.closeModal('modal-confirm');
        App.refreshAllViews();
      };
    }

    Utils.openModal('modal-confirm');
  },

  // Calculate Next Scheduled Date
  calculateNextDate(currentDateStr, frequency) {
    const date = new Date(currentDateStr);
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().split('T')[0];
  },

  // Automatic Processing Engine
  processRecurringRules() {
    const recurring = StorageManager.getRecurring();
    const todayStr = new Date().toISOString().split('T')[0];
    let generatedCount = 0;

    recurring.forEach(rule => {
      if (!rule.active) return;

      let nextDate = rule.nextDate || rule.startDate;

      // While nextDate is on or before today
      while (nextDate <= todayStr) {
        // Prevent duplicate creation if last processed date matches nextDate
        if (rule.lastProcessedDate !== nextDate) {
          const newTx = {
            id: Utils.generateId('tx'),
            title: rule.title,
            amount: rule.amount,
            type: rule.type,
            category: rule.category,
            date: nextDate,
            paymentMethod: rule.paymentMethod || 'Cash',
            notes: `Auto-generated from recurring rule (${rule.frequency})`,
            createdAt: new Date().toISOString()
          };

          StorageManager.addTransaction(newTx);
          generatedCount++;
          rule.lastProcessedDate = nextDate;
        }

        nextDate = this.calculateNextDate(nextDate, rule.frequency);
        rule.nextDate = nextDate;
      }

      StorageManager.updateRecurring(rule);
    });

    if (generatedCount > 0) {
      Utils.showToast(`Processed ${generatedCount} due recurring transaction(s).`, 'info');
    }
  },

  renderRecurringView() {
    const recurring = StorageManager.getRecurring();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();

    const tbody = document.getElementById('recurring-table-body');
    const emptyState = document.getElementById('recurring-empty-state');

    if (!tbody) return;

    if (recurring.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = recurring.map(r => {
      const cat = categories.find(c => c.id === r.category) || { name: 'Uncategorized', icon: 'folder' };
      return `
        <tr>
          <td>
            <div class="tx-title-wrapper">
              <div class="tx-icon-badge ${r.type}">
                <i data-lucide="${cat.icon || 'repeat'}"></i>
              </div>
              <strong>${r.title}</strong>
            </div>
          </td>
          <td><span class="badge badge-${r.type}">${r.type.toUpperCase()}</span></td>
          <td><strong class="amount-display ${r.type}">${Utils.formatCurrency(r.amount, settings.currency)}</strong></td>
          <td><span class="badge badge-method" style="text-transform: capitalize;">${r.frequency}</span></td>
          <td>${cat.name}</td>
          <td>${Utils.formatDate(r.nextDate, settings.dateFormat)}</td>
          <td>
            <button class="btn btn-sm ${r.active ? 'btn-ghost' : 'btn-secondary'}" onclick="RecurringManager.toggleRecurringActive('${r.id}')">
              ${r.active ? '<span class="text-success"><i data-lucide="play-circle"></i> Active</span>' : '<span class="text-muted"><i data-lucide="pause-circle"></i> Paused</span>'}
            </button>
          </td>
          <td class="text-center">
            <button class="btn btn-icon btn-sm" onclick="RecurringManager.openRecurringModal('${r.id}')" title="Edit">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn btn-icon btn-sm" onclick="RecurringManager.deleteRecurring('${r.id}')" title="Delete">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }
};
