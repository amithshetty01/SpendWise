/**
 * Settings & Data Management Module for SpendWise
 * Handles user preferences, JSON backup/restore, sample data seeder, and storage clearing.
 */

const SettingsManager = {
  init() {
    this.bindEvents();
    this.loadSettingsToForm();
  },

  bindEvents() {
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => this.savePreferences());

    const exportBackupBtn = document.getElementById('export-backup-btn');
    if (exportBackupBtn) exportBackupBtn.addEventListener('click', () => this.exportBackup());

    const importFileInput = document.getElementById('import-backup-file');
    if (importFileInput) importFileInput.addEventListener('change', (e) => this.importBackup(e));

    const loadDemoBtn = document.getElementById('load-sample-data-btn');
    if (loadDemoBtn) loadDemoBtn.addEventListener('click', () => this.loadSampleData());

    const clearAllBtn = document.getElementById('clear-all-data-btn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.confirmClearAllData());

    // Theme toggle button in sidebar
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const settings = StorageManager.getSettings();
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        settings.theme = newTheme;
        StorageManager.saveSettings(settings);
        this.applyTheme(newTheme);
        const themeSelect = document.getElementById('setting-theme');
        if (themeSelect) themeSelect.value = newTheme;
        Utils.showToast(`Theme switched to ${newTheme} mode.`, 'info');
      });
    }
  },

  loadSettingsToForm() {
    const settings = StorageManager.getSettings();
    const openingBalance = StorageManager.getOpeningBalance();

    const currencySelect = document.getElementById('setting-currency');
    const themeSelect = document.getElementById('setting-theme');
    const dateFormatSelect = document.getElementById('setting-date-format');
    const defaultRangeSelect = document.getElementById('setting-default-range');
    const openingInput = document.getElementById('setting-opening-balance');

    if (currencySelect) currencySelect.value = settings.currency || 'INR';
    if (themeSelect) themeSelect.value = settings.theme || 'light';
    if (dateFormatSelect) dateFormatSelect.value = settings.dateFormat || 'DD/MM/YYYY';
    if (defaultRangeSelect) defaultRangeSelect.value = settings.dashboardRange || 'this-month';
    if (openingInput) openingInput.value = openingBalance || 0;

    this.applyTheme(settings.theme || 'light');
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  },

  savePreferences() {
    const currency = document.getElementById('setting-currency').value;
    const theme = document.getElementById('setting-theme').value;
    const dateFormat = document.getElementById('setting-date-format').value;
    const dashboardRange = document.getElementById('setting-default-range').value;
    const openingBalance = parseFloat(document.getElementById('setting-opening-balance')?.value) || 0;

    const newSettings = { currency, theme, dateFormat, dashboardRange };
    StorageManager.saveSettings(newSettings);
    StorageManager.saveOpeningBalance(openingBalance);

    this.applyTheme(theme);
    Utils.showToast('Settings & preferences saved successfully!', 'success');
    App.refreshAllViews();
  },

  exportBackup() {
    const jsonStr = StorageManager.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `SpendWise_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Utils.showToast('Backup JSON file downloaded.', 'success');
  },

  importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById('confirm-modal-title').textContent = 'Restore Backup Data';
      document.getElementById('confirm-modal-message').textContent = 'Restoring this backup file will replace all existing transactions, categories, and budgets. Are you sure you want to proceed?';

      const confirmBtn = document.getElementById('confirm-btn-action');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          const result = StorageManager.importBackupJSON(event.target.result);
          Utils.closeModal('modal-confirm');

          if (result.success) {
            Utils.showToast('Backup restored successfully!', 'success');
            this.loadSettingsToForm();
            App.refreshAllViews();
          } else {
            Utils.showToast(result.error, 'error');
          }
        };
      }

      Utils.openModal('modal-confirm');
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
  },

  loadSampleData() {
    document.getElementById('confirm-modal-title').textContent = 'Load Sample Demo Data';
    document.getElementById('confirm-modal-message').textContent = 'This will populate your tracker with sample transactions, budgets, and savings goals so you can test all features. Existing custom data will be replaced. Continue?';

    const confirmBtn = document.getElementById('confirm-btn-action');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        const sampleTransactions = [
          { id: 'tx_s1', title: 'Monthly Salary Credit', amount: 125000, type: 'income', category: 'cat_sal', date: '2026-09-01', paymentMethod: 'Bank Transfer', notes: 'Monthly Tech Corp Salary', createdAt: '2026-09-01T09:00:00.000Z' },
          { id: 'tx_s2', title: 'Freelance Web Design', amount: 35000, type: 'income', category: 'cat_free', date: '2026-09-10', paymentMethod: 'UPI', notes: 'E-commerce UI design milestone', createdAt: '2026-09-10T14:30:00.000Z' },
          { id: 'tx_s3', title: 'Apartment Rent', amount: 28000, type: 'expense', category: 'cat_rent', date: '2026-09-02', paymentMethod: 'Net Banking', notes: 'Flat 402 Rent', createdAt: '2026-09-02T10:00:00.000Z' },
          { id: 'tx_s4', title: 'Supermarket Groceries', amount: 8450, type: 'expense', category: 'cat_groc', date: '2026-09-05', paymentMethod: 'Credit Card', notes: 'Monthly pantry restock', createdAt: '2026-09-05T18:15:00.000Z' },
          { id: 'tx_s5', title: 'Electricity & Internet Bill', amount: 3600, type: 'expense', category: 'cat_util', date: '2026-09-07', paymentMethod: 'UPI', notes: 'Airtel Fiber & Power bill', createdAt: '2026-09-07T11:20:00.000Z' },
          { id: 'tx_s6', title: 'Weekend Dining & Cafe', amount: 4200, type: 'expense', category: 'cat_food', date: '2026-09-12', paymentMethod: 'Credit Card', notes: 'Dinner with friends at Social', createdAt: '2026-09-12T21:00:00.000Z' },
          { id: 'tx_s7', title: 'Car Petrol Refill', amount: 3500, type: 'expense', category: 'cat_fuel', date: '2026-09-15', paymentMethod: 'Debit Card', notes: 'Full tank XP95', createdAt: '2026-09-15T08:45:00.000Z' },
          { id: 'tx_s8', title: 'Netflix & Spotify Subscriptions', amount: 1199, type: 'expense', category: 'cat_sub', date: '2026-09-18', paymentMethod: 'Credit Card', notes: 'Auto-debit recurring', createdAt: '2026-09-18T06:00:00.000Z' },
          { id: 'tx_s9', title: 'Stock Dividend Yield', amount: 4800, type: 'income', category: 'cat_inv', date: '2026-09-20', paymentMethod: 'Bank Transfer', notes: 'Q2 Dividend Payout', createdAt: '2026-09-20T12:00:00.000Z' },
          { id: 'tx_s10', title: 'New Mechanical Keyboard', amount: 6499, type: 'expense', category: 'cat_shop', date: '2026-09-22', paymentMethod: 'UPI', notes: 'Keychron K2 wireless', createdAt: '2026-09-22T16:10:00.000Z' }
        ];

        const sampleBudgets = {
          'cat_food': 12000,
          'cat_rent': 30000,
          'cat_groc': 10000,
          'cat_fuel': 5000,
          'cat_shop': 8000
        };

        const sampleGoals = [
          { id: 'g_s1', title: 'Japan Vacation Fund', targetAmount: 250000, currentAmount: 110000, targetDate: '2027-04-15', description: '2 week trip to Tokyo & Kyoto', contributions: [] },
          { id: 'g_s2', title: 'Emergency Reserves', targetAmount: 300000, currentAmount: 300000, targetDate: '2026-12-31', description: '6 months of living expenses', contributions: [] }
        ];

        const sampleRecurring = [
          { id: 'r_s1', title: 'Apartment Rent', amount: 28000, type: 'expense', category: 'cat_rent', frequency: 'monthly', startDate: '2026-10-01', nextDate: '2026-10-01', paymentMethod: 'Net Banking', active: true }
        ];

        StorageManager.saveTransactions(sampleTransactions);
        StorageManager.saveBudgets(sampleBudgets);
        StorageManager.saveOverallBudget(85000);
        StorageManager.saveGoals(sampleGoals);
        StorageManager.saveRecurring(sampleRecurring);

        Utils.showToast('Sample demo data loaded successfully!', 'success');
        Utils.closeModal('modal-confirm');
        App.refreshAllViews();
      };
    }

    Utils.openModal('modal-confirm');
  },

  confirmClearAllData() {
    document.getElementById('confirm-modal-title').textContent = 'CLEAR ALL DATA';
    document.getElementById('confirm-modal-message').textContent = 'DANGER: Are you absolutely sure you want to erase all financial records, budgets, categories, and goals? This action cannot be reversed.';

    const confirmBtn = document.getElementById('confirm-btn-action');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        StorageManager.clearAllData();
        Utils.showToast('All app data has been cleared.', 'info');
        Utils.closeModal('modal-confirm');
        this.loadSettingsToForm();
        App.refreshAllViews();
      };
    }

    Utils.openModal('modal-confirm');
  }
};
