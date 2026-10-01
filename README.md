# SpendWise — Smart Personal Expense Tracker

SpendWise is a premium, client-side personal finance dashboard designed to streamline expense tracking, budgeting, financial analytics, savings targets, and scheduled recurring transactions—all running locally inside your browser with complete privacy.

---

## 🌟 Key Features

1. **Financial Dashboard & Analytics**
   - Live metrics: Total Balance, Total Income, Total Expenses, Remaining Monthly Budget, Savings Rate (%).
   - Dynamic date range filters (This Week, This Month, Last Month, This Year, All Time, Custom Date Range).
   - Chart.js visualizations: Income vs. Expenses bar chart, Category expense doughnut chart, Daily spending line trend.
   - Quick highlights: Highest spending category, Net savings, Budget health indicator.

2. **Transaction Management System**
   - Full CRUD operations for Income and Expense transactions.
   - Advanced search by title, description, category, or notes.
   - Multi-filtering by type, category, date, and payment method (Cash, Credit Card, Debit Card, UPI, Bank Transfer, Net Banking).
   - Sorting by newest, oldest, highest amount, and lowest amount.
   - Clean pagination control.
   - Transaction detail modal & delete confirmation dialog.

3. **Custom Category Management**
   - Income & Expense category customization with icons and color coding.
   - Safety check: Prevents deleting categories in use until existing transactions are reassigned.

4. **Budget Management**
   - Set overall monthly spending budget caps.
   - Category-specific monthly budget limits.
   - Color-coded progress indicators (`<80%` On Track, `80%-99%` Warning, `>=100%` Exceeded alert).

5. **Financial Intelligence Reports & Exports**
   - Export transactions to CSV.
   - Export structured monthly financial summaries to CSV.
   - Print-friendly stylesheet (`@media print`) for instant PDF or paper reports.

6. **Savings Goals & Contributions**
   - Target goal tracking with completion progress bars and target dates.
   - Contribution logging tracked independently to prevent double-counting income.

7. **Recurring Transactions Engine**
   - Automate daily, weekly, monthly, or yearly recurring salaries, rent, and utility bills.
   - Automatic background processing on app open with toast log summary.

8. **Transaction Calendar**
   - Monthly calendar grid showing daily income and expense totals.
   - Date popover modal detailing daily transactions with quick add shortcuts.

9. **Data Persistence & LocalStorage Backups**
   - HTML5 LocalStorage persistence.
   - Export complete dataset to JSON backup file.
   - Import JSON backup file with validation and overwrite confirmation.
   - Curated sample demo data generator for instant testing.
   - Clear All Data button with confirmation modal.

10. **Customizable Themes & Currencies**
    - Dark Navy (default) and Light mode theme toggle.
    - Currency selection (Default Indian Rupee `₹ INR` formatted with the Indian Numbering System e.g., `₹1,25,000.00`, USD `$`, EUR `€`, GBP `£`, AED, CAD).

---

## 📁 Project Folder Structure

```
spendwise/
├── index.html          # Main SPA structure, header, sidebar, views, and modals
├── css/
│   └── style.css       # Complete CSS design system, themes, grid layouts & print styles
├── js/
│   ├── app.js          # Core SPA router, tab navigation & app initialization
│   ├── storage.js      # LocalStorage data persistence, schema versioning & JSON backup
│   ├── utils.js        # Currency formatter, date range helpers, toasts & CSV exporter
│   ├── transactions.js # Transaction CRUD, multi-filters, pagination & category manager
│   ├── dashboard.js    # Metric calculations & Chart.js interactive charts
│   ├── budgets.js      # Monthly category and overall budget tracking
│   ├── reports.js      # Analytics reports, CSV exporter & print handler
│   ├── goals.js        # Savings goals and contribution tracking
│   ├── recurring.js    # Recurring transactions scheduled engine
│   ├── calendar.js     # Monthly interactive calendar view
│   └── settings.js     # Preferences, backup JSON download/upload & demo data seeder
└── README.md           # Project documentation and deployment guide
```

---

## 🚀 How to Run Locally

Since SpendWise is a pure client-side web application built with standard HTML5, CSS3, and JavaScript, no backend server or Node.js build step is required!

### Option 1: Direct File Open
Simply double-click `index.html` or open it in any modern browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local HTTP Dev Server (Recommended)
Using VS Code Live Server extension or Python built-in HTTP server:

```bash
# Using Python 3
python -m http.server 8000
```

Then open `http://localhost:8000` in your web browser.

---

## 🌐 Deploying to GitHub Pages

1. Create a GitHub repository named `spendwise`.
2. Push all project files to your repository:

```bash
git init
git add .
git commit -m "Initial commit - SpendWise Web Application"
git branch -M main
git remote add origin https://github.com/your-username/spendwise.git
git push -u origin main
```

3. Go to repository **Settings** -> **Pages**.
4. Under **Build and deployment** -> **Source**, select `Deploy from a branch`.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. Your live site will be accessible at: `https://your-username.github.io/spendwise/`

---

## ⚠️ Limitations & Notes

- **Browser-Specific Data**: All financial data is stored inside the browser's `LocalStorage`. Clearing browser cache/cookies will delete stored records unless a JSON backup has been downloaded.
- **Currency Conversion**: Changing the display currency in Settings updates currency symbols and formatting across the app; it does not convert historical transaction figures using live exchange rates.
