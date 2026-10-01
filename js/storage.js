/**
 * Storage Manager for SpendWise
 * Powered by IndexedDB for persistent, offline-first financial data storage with LocalStorage fallback/migration.
 */

const DB_NAME = 'SpendWiseDB';
const DB_VERSION = 1;

const DEFAULT_CATEGORIES = [
  // Income Categories
  { id: 'cat_sal', name: 'Salary', type: 'income', icon: 'briefcase', color: '#10b981', isDefault: true },
  { id: 'cat_free', name: 'Freelance', type: 'income', icon: 'laptop', color: '#06b6d4', isDefault: true },
  { id: 'cat_biz', name: 'Business', type: 'income', icon: 'building', color: '#3b82f6', isDefault: true },
  { id: 'cat_inv', name: 'Investments', type: 'income', icon: 'trending-up', color: '#8b5cf6', isDefault: true },
  { id: 'cat_int', name: 'Interest', type: 'income', icon: 'percent', color: '#ec4899', isDefault: true },
  { id: 'cat_gift', name: 'Gifts', type: 'income', icon: 'gift', color: '#f59e0b', isDefault: true },
  { id: 'cat_other_inc', name: 'Other Income', type: 'income', icon: 'circle-dollar-sign', color: '#10b981', isDefault: true },

  // Expense Categories
  { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#f43f5e', isDefault: true },
  { id: 'cat_groc', name: 'Groceries', type: 'expense', icon: 'shopping-bag', color: '#fb923c', isDefault: true },
  { id: 'cat_trans', name: 'Transportation', type: 'expense', icon: 'car', color: '#f59e0b', isDefault: true },
  { id: 'cat_fuel', name: 'Fuel', type: 'expense', icon: 'fuel', color: '#eab308', isDefault: true },
  { id: 'cat_shop', name: 'Shopping', type: 'expense', icon: 'shopping-cart', color: '#ec4899', isDefault: true },
  { id: 'cat_rent', name: 'Housing & Rent', type: 'expense', icon: 'home', color: '#8b5cf6', isDefault: true },
  { id: 'cat_util', name: 'Bills & Utilities', type: 'expense', icon: 'zap', color: '#06b6d4', isDefault: true },
  { id: 'cat_health', name: 'Healthcare', type: 'expense', icon: 'heart-pulse', color: '#14b8a6', isDefault: true },
  { id: 'cat_edu', name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#3b82f6', isDefault: true },
  { id: 'cat_ent', name: 'Entertainment', type: 'expense', icon: 'film', color: '#a855f7', isDefault: true },
  { id: 'cat_trav', name: 'Travel', type: 'expense', icon: 'plane', color: '#0284c7', isDefault: true },
  { id: 'cat_sub', name: 'Subscriptions', type: 'expense', icon: 'repeat', color: '#6366f1', isDefault: true },
  { id: 'cat_care', name: 'Personal Care', type: 'expense', icon: 'sparkles', color: '#f43f5e', isDefault: true },
  { id: 'cat_other_exp', name: 'Other Expenses', type: 'expense', icon: 'folder', color: '#6b7280', isDefault: true }
];

const DEFAULT_SETTINGS = {
  currency: 'INR',
  theme: 'light',
  dateFormat: 'DD/MM/YYYY',
  dashboardRange: 'this-month',
  openingBalance: 0
};

const StorageManager = {
  db: null,
  isInitialized: false,
  initPromise: null,

  // Synchronous in-memory cache for ultra-responsive UI
  cache: {
    transactions: [],
    categories: DEFAULT_CATEGORIES,
    budgets: {},
    overallBudget: 0,
    goals: [],
    recurring: [],
    settings: DEFAULT_SETTINGS,
    openingBalance: 0
  },

  // Initialize IndexedDB database and hydrate memory cache
  init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported by browser. Falling back to LocalStorage.');
        this.loadFromLocalStorageFallback();
        this.isInitialized = true;
        resolve();
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recurring')) {
          db.createObjectStore('recurring', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('app_meta')) {
          db.createObjectStore('app_meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        try {
          await this.loadAllFromIDB();
          this.isInitialized = true;
          resolve();
        } catch (err) {
          console.error('Error loading data from IndexedDB:', err);
          this.loadFromLocalStorageFallback();
          this.isInitialized = true;
          resolve();
        }
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e.target.error);
        this.loadFromLocalStorageFallback();
        this.isInitialized = true;
        resolve();
      };
    });

    return this.initPromise;
  },

  // Load all stores from IndexedDB into cache
  async loadAllFromIDB() {
    if (!this.db) return;

    const txns = await this.getAllFromStore('transactions');
    const cats = await this.getAllFromStore('categories');
    const goals = await this.getAllFromStore('goals');
    const recurring = await this.getAllFromStore('recurring');
    const appMeta = await this.getAllFromStore('app_meta');

    const metaMap = {};
    appMeta.forEach(item => { metaMap[item.key] = item.value; });

    // Check if IndexedDB is fresh. If so, check for legacy LocalStorage migration
    if (!metaMap.initialized) {
      const legacyInitialized = localStorage.getItem('spendwise_initialized_v1');
      if (legacyInitialized) {
        console.log('Migrating legacy LocalStorage data to IndexedDB...');
        this.loadFromLocalStorageFallback();
        await this.syncAllToIDB();
      } else {
        // Brand new installation: seed defaults
        this.cache.categories = DEFAULT_CATEGORIES;
        this.cache.settings = DEFAULT_SETTINGS;
        this.cache.transactions = [];
        this.cache.budgets = {};
        this.cache.overallBudget = 0;
        this.cache.goals = [];
        this.cache.recurring = [];
        this.cache.openingBalance = 0;
        await this.syncAllToIDB();
      }
      await this.saveMetaToIDB('initialized', true);
    } else {
      this.cache.transactions = txns || [];
      this.cache.categories = (cats && cats.length > 0) ? cats : DEFAULT_CATEGORIES;
      this.cache.goals = goals || [];
      this.cache.recurring = recurring || [];
      this.cache.budgets = metaMap.budgets || {};
      this.cache.overallBudget = metaMap.overallBudget || 0;
      this.cache.settings = metaMap.settings || DEFAULT_SETTINGS;
      this.cache.openingBalance = metaMap.openingBalance || 0;
    }
  },

  // IndexedDB Helper: Get all records from store
  getAllFromStore(storeName) {
    return new Promise((resolve) => {
      if (!this.db) return resolve([]);
      try {
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  },

  // Save single meta item to app_meta store
  saveMetaToIDB(key, value) {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction('app_meta', 'readwrite');
        const store = tx.objectStore('app_meta');
        store.put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  },

  // Sync entire array to store
  syncStoreToIDB(storeName, items) {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      try {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        items.forEach(item => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  },

  // Sync all in-memory cache state into IDB and LocalStorage backup
  async syncAllToIDB() {
    if (!this.db) return;
    await this.syncStoreToIDB('transactions', this.cache.transactions);
    await this.syncStoreToIDB('categories', this.cache.categories);
    await this.syncStoreToIDB('goals', this.cache.goals);
    await this.syncStoreToIDB('recurring', this.cache.recurring);
    await this.saveMetaToIDB('budgets', this.cache.budgets);
    await this.saveMetaToIDB('overallBudget', this.cache.overallBudget);
    await this.saveMetaToIDB('settings', this.cache.settings);
    await this.saveMetaToIDB('openingBalance', this.cache.openingBalance);
    await this.saveMetaToIDB('initialized', true);

    this.saveToLocalStorageFallback();
  },

  // Backup LocalStorage sync for backward compatibility
  saveToLocalStorageFallback() {
    try {
      localStorage.setItem('spendwise_transactions_v1', JSON.stringify(this.cache.transactions));
      localStorage.setItem('spendwise_categories_v1', JSON.stringify(this.cache.categories));
      localStorage.setItem('spendwise_budgets_v1', JSON.stringify(this.cache.budgets));
      localStorage.setItem('spendwise_overall_budget_v1', this.cache.overallBudget.toString());
      localStorage.setItem('spendwise_goals_v1', JSON.stringify(this.cache.goals));
      localStorage.setItem('spendwise_recurring_v1', JSON.stringify(this.cache.recurring));
      localStorage.setItem('spendwise_settings_v1', JSON.stringify(this.cache.settings));
      localStorage.setItem('spendwise_opening_balance_v1', this.cache.openingBalance.toString());
      localStorage.setItem('spendwise_initialized_v1', 'true');
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  },

  loadFromLocalStorageFallback() {
    try {
      this.cache.transactions = JSON.parse(localStorage.getItem('spendwise_transactions_v1')) || [];
      this.cache.categories = JSON.parse(localStorage.getItem('spendwise_categories_v1')) || DEFAULT_CATEGORIES;
      this.cache.budgets = JSON.parse(localStorage.getItem('spendwise_budgets_v1')) || {};
      this.cache.overallBudget = parseFloat(localStorage.getItem('spendwise_overall_budget_v1')) || 0;
      this.cache.goals = JSON.parse(localStorage.getItem('spendwise_goals_v1')) || [];
      this.cache.recurring = JSON.parse(localStorage.getItem('spendwise_recurring_v1')) || [];
      this.cache.settings = JSON.parse(localStorage.getItem('spendwise_settings_v1')) || DEFAULT_SETTINGS;
      this.cache.openingBalance = parseFloat(localStorage.getItem('spendwise_opening_balance_v1')) || 0;
    } catch (e) {
      console.warn('Error reading from LocalStorage fallback:', e);
    }
  },

  // --- Transactions CRUD ---
  getTransactions() {
    return this.cache.transactions || [];
  },

  saveTransactions(transactions) {
    this.cache.transactions = transactions;
    this.syncStoreToIDB('transactions', transactions);
    this.saveToLocalStorageFallback();
  },

  addTransaction(tx) {
    this.cache.transactions.unshift(tx);
    this.saveTransactions(this.cache.transactions);
    return tx;
  },

  updateTransaction(updatedTx) {
    this.cache.transactions = this.cache.transactions.map(t => t.id === updatedTx.id ? updatedTx : t);
    this.saveTransactions(this.cache.transactions);
  },

  deleteTransaction(id) {
    this.cache.transactions = this.cache.transactions.filter(t => t.id !== id);
    this.saveTransactions(this.cache.transactions);
  },

  // --- Categories CRUD ---
  getCategories() {
    return this.cache.categories && this.cache.categories.length > 0 ? this.cache.categories : DEFAULT_CATEGORIES;
  },

  saveCategories(categories) {
    this.cache.categories = categories;
    this.syncStoreToIDB('categories', categories);
    this.saveToLocalStorageFallback();
  },

  addCategory(cat) {
    this.cache.categories.push(cat);
    this.saveCategories(this.cache.categories);
    return cat;
  },

  updateCategory(updatedCat) {
    this.cache.categories = this.cache.categories.map(c => c.id === updatedCat.id ? updatedCat : c);
    this.saveCategories(this.cache.categories);
  },

  deleteCategory(id) {
    this.cache.categories = this.cache.categories.filter(c => c.id !== id);
    this.saveCategories(this.cache.categories);
  },

  // --- Budgets CRUD ---
  getBudgets() {
    return this.cache.budgets || {};
  },

  saveBudgets(budgets) {
    this.cache.budgets = budgets;
    this.saveMetaToIDB('budgets', budgets);
    this.saveToLocalStorageFallback();
  },

  setCategoryBudget(categoryId, amount) {
    const budgets = this.getBudgets();
    if (amount <= 0) {
      delete budgets[categoryId];
    } else {
      budgets[categoryId] = amount;
    }
    this.saveBudgets(budgets);
  },

  getOverallBudget() {
    return this.cache.overallBudget || 0;
  },

  saveOverallBudget(amount) {
    this.cache.overallBudget = amount;
    this.saveMetaToIDB('overallBudget', amount);
    this.saveToLocalStorageFallback();
  },

  // --- Opening Balance ---
  getOpeningBalance() {
    return this.cache.openingBalance || 0;
  },

  saveOpeningBalance(amount) {
    const numeric = parseFloat(amount) || 0;
    this.cache.openingBalance = numeric;
    this.saveMetaToIDB('openingBalance', numeric);
    this.saveToLocalStorageFallback();
  },

  // --- Savings Goals CRUD ---
  getGoals() {
    return this.cache.goals || [];
  },

  saveGoals(goals) {
    this.cache.goals = goals;
    this.syncStoreToIDB('goals', goals);
    this.saveToLocalStorageFallback();
  },

  addGoal(goal) {
    this.cache.goals.unshift(goal);
    this.saveGoals(this.cache.goals);
    return goal;
  },

  updateGoal(updatedGoal) {
    this.cache.goals = this.cache.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g);
    this.saveGoals(this.cache.goals);
  },

  deleteGoal(id) {
    this.cache.goals = this.cache.goals.filter(g => g.id !== id);
    this.saveGoals(this.cache.goals);
  },

  // --- Recurring Transactions CRUD ---
  getRecurring() {
    return this.cache.recurring || [];
  },

  saveRecurring(recurring) {
    this.cache.recurring = recurring;
    this.syncStoreToIDB('recurring', recurring);
    this.saveToLocalStorageFallback();
  },

  addRecurring(rec) {
    this.cache.recurring.unshift(rec);
    this.saveRecurring(this.cache.recurring);
    return rec;
  },

  updateRecurring(updatedRec) {
    this.cache.recurring = this.cache.recurring.map(r => r.id === updatedRec.id ? updatedRec : r);
    this.saveRecurring(this.cache.recurring);
  },

  deleteRecurring(id) {
    this.cache.recurring = this.cache.recurring.filter(r => r.id !== id);
    this.saveRecurring(this.cache.recurring);
  },

  // --- Settings ---
  getSettings() {
    return this.cache.settings || DEFAULT_SETTINGS;
  },

  saveSettings(settings) {
    this.cache.settings = settings;
    this.saveMetaToIDB('settings', settings);
    this.saveToLocalStorageFallback();
  },

  // --- Export JSON Backup ---
  exportBackupJSON() {
    const backupData = {
      version: '1.0',
      storageEngine: 'IndexedDB',
      exportedAt: new Date().toISOString(),
      transactions: this.getTransactions(),
      categories: this.getCategories(),
      budgets: this.getBudgets(),
      overallBudget: this.getOverallBudget(),
      goals: this.getGoals(),
      recurring: this.getRecurring(),
      settings: this.getSettings(),
      openingBalance: this.getOpeningBalance()
    };
    return JSON.stringify(backupData, null, 2);
  },

  // --- Import JSON Backup ---
  async importBackupJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') return { success: false, error: 'Invalid JSON format.' };

      if (Array.isArray(data.transactions)) this.cache.transactions = data.transactions;
      if (Array.isArray(data.categories)) this.cache.categories = data.categories;
      if (data.budgets && typeof data.budgets === 'object') this.cache.budgets = data.budgets;
      if (typeof data.overallBudget === 'number') this.cache.overallBudget = data.overallBudget;
      if (Array.isArray(data.goals)) this.cache.goals = data.goals;
      if (Array.isArray(data.recurring)) this.cache.recurring = data.recurring;
      if (data.settings && typeof data.settings === 'object') this.cache.settings = data.settings;
      if (typeof data.openingBalance === 'number') this.cache.openingBalance = data.openingBalance;

      await this.syncAllToIDB();
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to parse JSON file: ' + e.message };
    }
  },

  // --- Clear All Data ---
  async clearAllData() {
    this.cache = {
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      budgets: {},
      overallBudget: 0,
      goals: [],
      recurring: [],
      settings: DEFAULT_SETTINGS,
      openingBalance: 0
    };
    await this.syncAllToIDB();
  }
};

// Initiate background connection to IndexedDB
StorageManager.init();
