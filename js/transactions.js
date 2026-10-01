/**
 * Transactions Manager Module for SpendWise
 * Handles transaction filtering, search, pagination, CRUD, and category management.
 */

const TransactionsManager = {
  currentPage: 1,
  pageSize: 10,
  currentCategoryTab: 'expense',
  pendingDeleteCategoryId: null,
  pendingDeleteTxId: null,

  init() {
    this.bindEvents();
    this.populateCategorySelects();
  },

  bindEvents() {
    // Search & Filter listeners
    const searchInput = document.getElementById('tx-search-input');
    const filterType = document.getElementById('tx-filter-type');
    const filterCategory = document.getElementById('tx-filter-category');
    const filterMethod = document.getElementById('tx-filter-method');
    const sortBy = document.getElementById('tx-sort-by');

    if (searchInput) searchInput.addEventListener('input', () => { this.currentPage = 1; this.renderTransactionsTable(); });
    if (filterType) filterType.addEventListener('change', () => { this.currentPage = 1; this.renderTransactionsTable(); });
    if (filterCategory) filterCategory.addEventListener('change', () => { this.currentPage = 1; this.renderTransactionsTable(); });
    if (filterMethod) filterMethod.addEventListener('change', () => { this.currentPage = 1; this.renderTransactionsTable(); });
    if (sortBy) sortBy.addEventListener('change', () => { this.renderTransactionsTable(); });

    // Pagination controls
    const prevBtn = document.getElementById('tx-prev-page');
    const nextBtn = document.getElementById('tx-next-page');

    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTransactionsTable();
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      this.currentPage++;
      this.renderTransactionsTable();
    });

    // Add Transaction buttons
    const openAddBtn = document.getElementById('open-add-tx-btn');
    const headerAddBtn = document.getElementById('header-add-btn');
    const quickAddBtn = document.getElementById('quick-add-btn');
    const emptyAddBtn = document.getElementById('empty-add-tx-btn');

    [openAddBtn, headerAddBtn, quickAddBtn, emptyAddBtn].forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.openAddTransactionModal());
    });

    // Transaction form submit
    const txForm = document.getElementById('form-transaction');
    if (txForm) txForm.addEventListener('submit', (e) => this.handleTransactionFormSubmit(e));

    // Dynamic type change in transaction modal updates categories
    const txTypeSelect = document.getElementById('tx-type');
    if (txTypeSelect) {
      txTypeSelect.addEventListener('change', (e) => {
        this.populateModalCategoryDropdown(e.target.value);
      });
    }

    // Category Manager Modal buttons
    const manageCatBtn = document.getElementById('manage-categories-btn');
    if (manageCatBtn) manageCatBtn.addEventListener('click', () => this.openCategoryManagerModal());

    // Category tabs
    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategoryTab = e.target.dataset.catType;
        document.getElementById('cat-type-input').value = this.currentCategoryTab;
        this.renderCategoryList();
      });
    });

    // Add category form submit
    const addCatForm = document.getElementById('form-add-category');
    if (addCatForm) addCatForm.addEventListener('submit', (e) => this.handleAddCategorySubmit(e));

    // Confirm reassign delete
    const confirmReassignBtn = document.getElementById('confirm-reassign-delete-btn');
    if (confirmReassignBtn) confirmReassignBtn.addEventListener('click', () => this.handleCategoryReassignAndDelete());
  },

  populateCategorySelects() {
    const categories = StorageManager.getCategories();
    const filterCatSelect = document.getElementById('tx-filter-category');

    if (filterCatSelect) {
      filterCatSelect.innerHTML = '<option value="all">All Categories</option>';
      categories.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = `${c.name} (${c.type === 'income' ? 'Income' : 'Expense'})`;
        filterCatSelect.appendChild(option);
      });
    }

    this.populateModalCategoryDropdown('expense');
  },

  populateModalCategoryDropdown(type, selectedId = null) {
    const categories = StorageManager.getCategories().filter(c => c.type === type);
    const modalCatSelect = document.getElementById('tx-category');

    if (modalCatSelect) {
      modalCatSelect.innerHTML = '';
      categories.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        if (selectedId && c.id === selectedId) option.selected = true;
        modalCatSelect.appendChild(option);
      });
    }
  },

  openAddTransactionModal(presetDate = null) {
    const form = document.getElementById('form-transaction');
    if (form) form.reset();

    document.getElementById('modal-tx-title').textContent = 'Add Transaction';
    document.getElementById('tx-id').value = '';
    
    // Set default date to today or presetDate
    const dateInput = document.getElementById('tx-date');
    if (dateInput) {
      dateInput.value = presetDate || new Date().toISOString().split('T')[0];
    }

    this.populateModalCategoryDropdown('expense');
    Utils.openModal('modal-transaction');
  },

  openEditTransactionModal(txId) {
    const transactions = StorageManager.getTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    document.getElementById('modal-tx-title').textContent = 'Edit Transaction';
    document.getElementById('tx-id').value = tx.id;
    document.getElementById('tx-type').value = tx.type;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-title').value = tx.title;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-method').value = tx.paymentMethod || 'Cash';
    document.getElementById('tx-notes').value = tx.notes || '';

    this.populateModalCategoryDropdown(tx.type, tx.category);
    Utils.openModal('modal-transaction');
  },

  handleTransactionFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('tx-id').value;
    const type = document.getElementById('tx-type').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const title = document.getElementById('tx-title').value.trim();
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const paymentMethod = document.getElementById('tx-method').value;
    const notes = document.getElementById('tx-notes').value.trim();

    // Validation
    if (!title) {
      Utils.showToast('Please enter a transaction title.', 'warning');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      Utils.showToast('Amount must be a positive number greater than zero.', 'warning');
      return;
    }
    if (!date) {
      Utils.showToast('Please select a valid transaction date.', 'warning');
      return;
    }
    if (!category) {
      Utils.showToast('Please select a category.', 'warning');
      return;
    }

    const txData = {
      id: id || Utils.generateId('tx'),
      title,
      amount,
      type,
      category,
      date,
      paymentMethod,
      notes,
      createdAt: id ? (StorageManager.getTransactions().find(t => t.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    if (id) {
      StorageManager.updateTransaction(txData);
      Utils.showToast('Transaction updated successfully!', 'success');
    } else {
      StorageManager.addTransaction(txData);
      Utils.showToast('New transaction added successfully!', 'success');
    }

    Utils.closeModal('modal-transaction');
    App.refreshAllViews();
  },

  viewTransactionDetails(txId) {
    const transactions = StorageManager.getTransactions();
    const categories = StorageManager.getCategories();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const cat = categories.find(c => c.id === tx.category) || { name: 'Uncategorized', icon: 'folder' };
    const settings = StorageManager.getSettings();

    const body = document.getElementById('view-tx-body');
    if (body) {
      body.innerHTML = `
        <div class="tx-detail-card">
          <div class="tx-detail-amount ${tx.type}">
            ${tx.type === 'income' ? '+' : '-'}${Utils.formatCurrency(tx.amount, settings.currency)}
          </div>
          <h4 class="text-center font-bold text-lg mb-4">${tx.title}</h4>
          <table class="data-table">
            <tr><td><strong>Type</strong></td><td><span class="badge badge-${tx.type}">${tx.type.toUpperCase()}</span></td></tr>
            <tr><td><strong>Category</strong></td><td><i data-lucide="${cat.icon || 'folder'}"></i> ${cat.name}</td></tr>
            <tr><td><strong>Date</strong></td><td>${Utils.formatDate(tx.date, settings.dateFormat)}</td></tr>
            <tr><td><strong>Payment Method</strong></td><td><span class="badge badge-method">${tx.paymentMethod}</span></td></tr>
            <tr><td><strong>Notes</strong></td><td>${tx.notes ? tx.notes : '<em>None</em>'}</td></tr>
            <tr><td><strong>Transaction ID</strong></td><td><small>${tx.id}</small></td></tr>
          </table>
        </div>
      `;
    }

    const editBtn = document.getElementById('view-tx-edit-btn');
    const deleteBtn = document.getElementById('view-tx-delete-btn');

    if (editBtn) {
      editBtn.onclick = () => {
        Utils.closeModal('modal-view-tx');
        this.openEditTransactionModal(tx.id);
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = () => {
        Utils.closeModal('modal-view-tx');
        this.confirmDeleteTransaction(tx.id);
      };
    }

    if (window.lucide) window.lucide.createIcons();
    Utils.openModal('modal-view-tx');
  },

  confirmDeleteTransaction(txId) {
    this.pendingDeleteTxId = txId;
    document.getElementById('confirm-modal-title').textContent = 'Delete Transaction';
    document.getElementById('confirm-modal-message').textContent = 'Are you sure you want to permanently delete this transaction? This action cannot be undone.';
    
    const confirmBtn = document.getElementById('confirm-btn-action');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        StorageManager.deleteTransaction(this.pendingDeleteTxId);
        Utils.showToast('Transaction deleted.', 'info');
        Utils.closeModal('modal-confirm');
        App.refreshAllViews();
      };
    }

    Utils.openModal('modal-confirm');
  },

  getFilteredTransactions() {
    let transactions = StorageManager.getTransactions();

    const searchQuery = (document.getElementById('tx-search-input')?.value || '').toLowerCase();
    const filterType = document.getElementById('tx-filter-type')?.value || 'all';
    const filterCategory = document.getElementById('tx-filter-category')?.value || 'all';
    const filterMethod = document.getElementById('tx-filter-method')?.value || 'all';
    const sortBy = document.getElementById('tx-sort-by')?.value || 'newest';

    const categories = StorageManager.getCategories();

    // Filter
    transactions = transactions.filter(tx => {
      const cat = categories.find(c => c.id === tx.category);
      const catName = cat ? cat.name.toLowerCase() : '';
      
      const matchesSearch = !searchQuery || 
        tx.title.toLowerCase().includes(searchQuery) ||
        (tx.notes && tx.notes.toLowerCase().includes(searchQuery)) ||
        catName.includes(searchQuery);

      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
      const matchesMethod = filterMethod === 'all' || tx.paymentMethod === filterMethod;

      return matchesSearch && matchesType && matchesCategory && matchesMethod;
    });

    // Sort
    transactions.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });

    return transactions;
  },

  renderTransactionsTable() {
    const transactions = this.getFilteredTransactions();
    const categories = StorageManager.getCategories();
    const settings = StorageManager.getSettings();

    const tableBody = document.getElementById('tx-table-body');
    const emptyState = document.getElementById('tx-empty-state');
    const paginationBar = document.getElementById('tx-pagination-bar');

    if (!tableBody) return;

    if (transactions.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      if (paginationBar) paginationBar.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (paginationBar) paginationBar.style.display = 'flex';

    // Pagination logic
    const totalItems = transactions.length;
    const totalPages = Math.ceil(totalItems / this.pageSize);
    if (this.currentPage > totalPages) this.currentPage = totalPages || 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paginatedItems = transactions.slice(startIndex, startIndex + this.pageSize);

    // Update pagination info
    const infoSpan = document.getElementById('tx-pagination-info');
    const pageNumSpan = document.getElementById('tx-current-page');
    const prevBtn = document.getElementById('tx-prev-page');
    const nextBtn = document.getElementById('tx-next-page');

    if (infoSpan) infoSpan.textContent = `Showing ${startIndex + 1}-${Math.min(startIndex + this.pageSize, totalItems)} of ${totalItems} transactions`;
    if (pageNumSpan) pageNumSpan.textContent = this.currentPage;
    if (prevBtn) prevBtn.disabled = (this.currentPage === 1);
    if (nextBtn) nextBtn.disabled = (this.currentPage >= totalPages);

    // Render Table Rows
    tableBody.innerHTML = paginatedItems.map(tx => {
      const cat = categories.find(c => c.id === tx.category) || { name: 'Uncategorized', icon: 'folder' };
      const formattedAmount = `${tx.type === 'income' ? '+' : '-'}${Utils.formatCurrency(tx.amount, settings.currency)}`;
      
      return `
        <tr>
          <td>
            <div class="tx-title-wrapper">
              <div class="tx-icon-badge ${tx.type}">
                <i data-lucide="${cat.icon || 'circle-dollar-sign'}"></i>
              </div>
              <div>
                <strong>${tx.title}</strong>
                <div><span class="badge badge-${tx.type}">${tx.type}</span></div>
              </div>
            </div>
          </td>
          <td>${cat.name}</td>
          <td>${Utils.formatDate(tx.date, settings.dateFormat)}</td>
          <td><span class="badge badge-method">${tx.paymentMethod || 'Cash'}</span></td>
          <td><small class="text-secondary">${tx.notes ? (tx.notes.length > 25 ? tx.notes.substring(0, 25) + '...' : tx.notes) : '-'}</small></td>
          <td class="text-right amount-display ${tx.type}">${formattedAmount}</td>
          <td class="text-center">
            <button class="btn btn-icon btn-sm" onclick="TransactionsManager.viewTransactionDetails('${tx.id}')" title="View details">
              <i data-lucide="eye"></i>
            </button>
            <button class="btn btn-icon btn-sm" onclick="TransactionsManager.openEditTransactionModal('${tx.id}')" title="Edit">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn btn-icon btn-sm" onclick="TransactionsManager.confirmDeleteTransaction('${tx.id}')" title="Delete">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  // Category Management Handlers
  openCategoryManagerModal() {
    this.renderCategoryList();
    Utils.openModal('modal-categories');
  },

  renderCategoryList() {
    const categories = StorageManager.getCategories().filter(c => c.type === this.currentCategoryTab);
    const ul = document.getElementById('category-list-ul');
    if (!ul) return;

    ul.innerHTML = categories.map(c => `
      <li class="category-item">
        <div class="cat-item-left">
          <div class="tx-icon-badge" style="background: ${c.color}22; color: ${c.color}">
            <i data-lucide="${c.icon || 'folder'}"></i>
          </div>
          <strong>${c.name}</strong>
        </div>
        <div>
          ${c.isDefault ? '<span class="badge badge-method">Default</span>' : `
            <button class="btn btn-icon btn-sm" onclick="TransactionsManager.promptDeleteCategory('${c.id}')" title="Delete category">
              <i data-lucide="trash-2"></i>
            </button>
          `}
        </div>
      </li>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  handleAddCategorySubmit(e) {
    e.preventDefault();
    const type = document.getElementById('cat-type-input').value;
    const name = document.getElementById('cat-name-input').value.trim();
    const icon = document.getElementById('cat-icon-input').value;

    if (!name) return;

    const newCat = {
      id: Utils.generateId('cat'),
      name,
      type,
      icon,
      color: type === 'income' ? '#10b981' : '#f43f5e',
      isDefault: false
    };

    StorageManager.addCategory(newCat);
    Utils.showToast(`Category "${name}" added.`, 'success');
    document.getElementById('cat-name-input').value = '';
    
    this.populateCategorySelects();
    this.renderCategoryList();
    App.refreshAllViews();
  },

  promptDeleteCategory(catId) {
    const transactions = StorageManager.getTransactions();
    const catUsageCount = transactions.filter(t => t.category === catId).length;

    if (catUsageCount > 0) {
      // Category is in use, require re-assignment!
      this.pendingDeleteCategoryId = catId;
      const categories = StorageManager.getCategories().filter(c => c.type === this.currentCategoryTab && c.id !== catId);

      const reassignSelect = document.getElementById('reassign-select');
      if (reassignSelect) {
        reassignSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }

      document.getElementById('reassign-msg-text').textContent = `This category is used in ${catUsageCount} transaction(s). Please choose a replacement category before deleting:`;
      Utils.openModal('modal-reassign-cat');
    } else {
      // Directly delete
      StorageManager.deleteCategory(catId);
      Utils.showToast('Category deleted.', 'info');
      this.populateCategorySelects();
      this.renderCategoryList();
      App.refreshAllViews();
    }
  },

  handleCategoryReassignAndDelete() {
    const replacementId = document.getElementById('reassign-select').value;
    if (!replacementId || !this.pendingDeleteCategoryId) return;

    // Reassign transactions
    let transactions = StorageManager.getTransactions();
    transactions = transactions.map(t => {
      if (t.category === this.pendingDeleteCategoryId) {
        return { ...t, category: replacementId };
      }
      return t;
    });
    StorageManager.saveTransactions(transactions);

    // Delete category
    StorageManager.deleteCategory(this.pendingDeleteCategoryId);
    this.pendingDeleteCategoryId = null;

    Utils.showToast('Transactions reassigned and category deleted.', 'success');
    Utils.closeModal('modal-reassign-cat');

    this.populateCategorySelects();
    this.renderCategoryList();
    App.refreshAllViews();
  }
};
