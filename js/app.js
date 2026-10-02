/**
 * App Main Controller for SpendWise
 * Handles SPA navigation, mobile drawers, PWA service worker registration, offline status monitoring, and module coordination.
 */

const App = {
  currentView: 'dashboard',

  async init() {
    // Ensure IndexedDB storage is initialized before modules run
    await StorageManager.init();

    this.bindGlobalEvents();
    this.setupNavigation();
    this.setupModalsCloseHandlers();
    this.setupNetworkStatusListener();
    this.registerServiceWorker();

    // Initialize module controllers
    TransactionsManager.init();
    DashboardManager.init();
    BudgetsManager.init();
    ReportsManager.init();
    GoalsManager.init();
    RecurringManager.init();
    CalendarManager.init();
    SettingsManager.init();

    // Load stored settings (theme & default range)
    const settings = StorageManager.getSettings();
    if (settings) {
      SettingsManager.applyTheme(settings.theme || 'light');
      const dateFilterSelect = document.getElementById('global-date-range');
      if (dateFilterSelect && settings.dashboardRange) {
        dateFilterSelect.value = settings.dashboardRange;
      }
    }

    // Handle hash navigation
    const initialHash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(initialHash);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
          .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
      });
    }
  },

  setupNetworkStatusListener() {
    const updateStatus = () => {
      const badge = document.getElementById('offline-status-badge');
      const text = document.getElementById('status-text');
      const isOnline = navigator.onLine;

      if (badge && text) {
        if (isOnline) {
          badge.className = 'offline-status-badge online';
          text.textContent = 'Online';
        } else {
          badge.className = 'offline-status-badge offline';
          text.textContent = 'Airplane Mode (Offline)';
        }
      }
    };

    window.addEventListener('online', () => {
      updateStatus();
      Utils.showToast('Back online. Syncing app state.', 'success');
    });

    window.addEventListener('offline', () => {
      updateStatus();
      Utils.showToast('App is running in Airplane Mode (Offline). All features remain available.', 'warning');
    });

    updateStatus();
  },

  bindGlobalEvents() {
    // Mobile Sidebar Toggles & Body Scroll Lock
    const openBtn = document.getElementById('mobile-toggle-btn');
    const closeBtn = document.getElementById('mobile-close-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    const toggleSidebar = (show) => {
      if (sidebar) sidebar.classList.toggle('mobile-open', show);
      if (overlay) overlay.classList.toggle('active', show);
      if (show) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };
    this.toggleSidebar = toggleSidebar;

    if (openBtn) openBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));

    // Mobile FAB button quick add handler
    const mobileFabBtn = document.getElementById('mobile-fab-add-btn');
    if (mobileFabBtn) {
      mobileFabBtn.addEventListener('click', () => {
        TransactionsManager.openAddTransactionModal();
      });
    }

    // Handle window hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(hash);
      toggleSidebar(false);
    });
  },

  setupNavigation() {
    document.querySelectorAll('[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        const viewTarget = item.getAttribute('data-view');
        if (viewTarget) {
          this.navigateTo(viewTarget);
          if (this.toggleSidebar) {
            this.toggleSidebar(false);
          }
        }
      });
    });
  },

  setupModalsCloseHandlers() {
    // Close modal when clicking close buttons or backdrop
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        Utils.closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          Utils.closeModal(backdrop.id);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.active').forEach(m => {
          Utils.closeModal(m.id);
        });
      }
    });
  },

  navigateTo(viewId) {
    const views = document.querySelectorAll('.app-view');
    const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');

    let targetView = document.getElementById(`view-${viewId}`);
    if (!targetView) {
      viewId = 'dashboard';
      targetView = document.getElementById('view-dashboard');
    }

    // Hide all views, activate target
    views.forEach(v => v.classList.remove('active'));
    targetView.classList.add('active');

    // Update active state in sidebar & mobile bottom nav
    navItems.forEach(n => {
      if (n.getAttribute('data-view') === viewId) {
        n.classList.add('active');
      } else {
        n.classList.remove('active');
      }
    });

    this.currentView = viewId;

    // Update header title
    const titles = {
      dashboard: { title: 'Overview', sub: "Real-time summary of your cash flow and financial health." },
      transactions: { title: 'Transactions', sub: 'Filter, search, and audit your income and expenses.' },
      analytics: { title: 'Analytics', sub: 'Visual intelligence, spending trends, and statistical insights.' },
      reports: { title: 'Monthly Reports', sub: 'Monthly financial reporting, summaries, and data export.' },
      budgets: { title: 'Budgets', sub: 'Track spending caps and monitor category budget health.' },
      goals: { title: 'Savings Goals', sub: 'Manage milestone targets and savings contributions.' },
      recurring: { title: 'Recurring Transactions', sub: 'Automate salary, rent, and monthly bill payments.' },
      calendar: { title: 'Calendar View', sub: 'Inspect daily expenditures and cash flows on a month grid.' },
      settings: { title: 'Settings', sub: 'Preferences, categories, budgets, and data management.' }
    };

    const headerInfo = titles[viewId] || titles.dashboard;
    const pageTitle = document.getElementById('page-title');
    const pageSub = document.getElementById('page-subtitle');

    if (pageTitle) pageTitle.textContent = headerInfo.title;
    if (pageSub) pageSub.textContent = headerInfo.sub;

    // Show date filter on relevant pages (dashboard, analytics, reports)
    const dateFilterBox = document.getElementById('header-date-filter');
    if (dateFilterBox) {
      if (viewId === 'dashboard' || viewId === 'analytics' || viewId === 'reports') {
        dateFilterBox.style.display = 'flex';
      } else {
        dateFilterBox.style.display = 'none';
        const customContainer = document.getElementById('custom-date-container');
        if (customContainer) customContainer.style.display = 'none';
      }
    }

    // Refresh view specific content
    this.refreshCurrentView();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  refreshCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        DashboardManager.renderDashboard();
        break;
      case 'transactions':
        TransactionsManager.renderTransactionsTable();
        break;
      case 'analytics':
        AnalyticsManager.renderAnalyticsView();
        break;
      case 'reports':
        ReportsManager.renderReportsView();
        break;
      case 'budgets':
        BudgetsManager.renderBudgetsView();
        break;
      case 'goals':
        GoalsManager.renderGoalsView();
        break;
      case 'recurring':
        RecurringManager.renderRecurringView();
        break;
      case 'calendar':
        CalendarManager.renderCalendarView();
        break;
      case 'settings':
        SettingsManager.loadSettingsToForm();
        break;
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  refreshAllViews() {
    this.refreshCurrentView();
    TransactionsManager.populateCategorySelects();
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
