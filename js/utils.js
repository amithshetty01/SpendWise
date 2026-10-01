/**
 * Utility functions for SpendWise
 * Formatting, Date logic, Toast notifications, Modal controls, CSV export
 */

const Utils = {
  // Generate unique IDs
  generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  },

  // Currency formatting helper (Indian Numbering System for INR)
  formatCurrency(amount, currencyCode = 'INR') {
    const numericAmount = parseFloat(amount) || 0;

    const currencySymbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
      AED: 'AED ',
      CAD: 'CA$'
    };

    const symbol = currencySymbols[currencyCode] || '₹';

    if (currencyCode === 'INR') {
      // Indian numbering system formatting: 1,25,000.00
      const parts = numericAmount.toFixed(2).split('.');
      let lastThree = parts[0].substring(parts[0].length - 3);
      const otherNumbers = parts[0].substring(0, parts[0].length - 3);
      if (otherNumbers !== '') {
        lastThree = ',' + lastThree;
      }
      const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
      return `${symbol}${formattedInteger}.${parts[1]}`;
    }

    // Standard International format for non-INR currencies
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericAmount);
  },

  // Date Formatter according to user setting
  formatDate(dateString, formatPattern = 'DD/MM/YYYY') {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    switch (formatPattern) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
      default:
        return `${day}/${month}/${year}`;
    }
  },

  // Calculate Date Ranges
  getRangeDates(rangeKey, customStart = null, customEnd = null) {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    // Set time to end of day for endDate
    endDate.setHours(23, 59, 59, 999);

    switch (rangeKey) {
      case 'this-week': {
        const dayOfWeek = today.getDay(); // 0 is Sunday
        startDate.setDate(today.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'this-month': {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
        break;
      }
      case 'last-month': {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
      }
      case 'this-year': {
        startDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      }
      case 'all-time': {
        startDate = new Date(2000, 0, 1, 0, 0, 0, 0);
        break;
      }
      case 'custom': {
        if (customStart) {
          startDate = new Date(customStart);
          startDate.setHours(0, 0, 0, 0);
        } else {
          startDate = new Date(2000, 0, 1);
        }
        if (customEnd) {
          endDate = new Date(customEnd);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      }
      default: {
        // Default to this month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
      }
    }

    return { startDate, endDate };
  },

  // Check if date string falls within start and end date
  isInRange(dateStr, startDate, endDate) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= startDate && d <= endDate;
  },

  // Toast Notification Launcher
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'error') iconName = 'alert-circle';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    if (window.lucide) {
      window.lucide.createIcons();
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Modal Open & Close Helpers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  // Generic CSV Exporter
  exportToCSV(filename, rows) {
    if (!rows || !rows.length) {
      this.showToast('No data available to export.', 'warning');
      return;
    }

    const processRow = function (row) {
      return row.map(val => {
        if (val === null || val === undefined) return '""';
        let result = val.toString().replace(/"/g, '""');
        if (result.search(/("|,|\n)/g) >= 0) result = `"${result}"`;
        return result;
      }).join(',');
    };

    const csvContent = rows.map(processRow).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, filename);
    } else {
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
};
