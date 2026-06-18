// ====================================
// utils.js - Utility Modules
// ====================================

// Toast notification system
const Toast = {
  container: null,
  queue: [],
  maxVisible: 3,

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3000) {
    this.init();
    const icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: '\u2139' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    this.container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); },
};

// Confirmation dialog
const ConfirmDialog = {
  overlay: null,
  callback: null,

  init() {
    this.overlay = document.getElementById('confirmOverlay');
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'confirmOverlay';
      this.overlay.className = 'modal';
      this.overlay.style.display = 'none';
      this.overlay.innerHTML = `
        <div class="modal-overlay" id="confirmBg"></div>
        <div class="modal-content" style="max-width:400px;">
          <div class="modal-body" style="text-align:center;">
            <p id="confirmMessage" style="font-size:16px;margin-bottom:24px;"></p>
            <div style="display:flex;gap:12px;justify-content:center;">
              <button class="btn btn-secondary" id="confirmCancel">取消</button>
              <button class="btn btn-danger" id="confirmOk">确定</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(this.overlay);
      this.overlay.querySelector('#confirmCancel').addEventListener('click', () => this.hide());
      this.overlay.querySelector('#confirmBg').addEventListener('click', () => this.hide());
    }
  },

  show(message) {
    this.init();
    return new Promise((resolve) => {
      this.callback = resolve;
      document.getElementById('confirmMessage').textContent = message;
      this.overlay.style.display = 'flex';
      document.getElementById('confirmOk').onclick = () => {
        this.hide();
        resolve(true);
      };
    });
  },

  hide() {
    this.overlay.style.display = 'none';
    if (this.callback) {
      this.callback(false);
      this.callback = null;
    }
  },
};

// Search highlight utility
const SearchHighlight = {
  highlight(text, query) {
    if (!query || !text) return this.escapeHtml(text);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark class="search-highlight">$1</mark>');
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// File type detection
const FileType = {
  MARKDOWN: ['md', 'markdown', 'mdx'],
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
  PDF: ['pdf'],
  VIDEO: ['mp4', 'webm', 'ogg', 'mov', 'avi'],
  AUDIO: ['mp3', 'wav', 'ogg', 'flac', 'aac'],

  detect(path) {
    if (!path) return 'unknown';
    const ext = path.split('.').pop().toLowerCase();
    if (this.MARKDOWN.includes(ext)) return 'markdown';
    if (this.IMAGE.includes(ext)) return 'image';
    if (this.PDF.includes(ext)) return 'pdf';
    if (this.VIDEO.includes(ext)) return 'video';
    if (this.AUDIO.includes(ext)) return 'audio';
    return 'other';
  },

  getIcon(type) {
    const icons = {
      markdown: '\uD83D\uDCC4',
      image: '\uD83D\uDCDE',
      pdf: '\uD83D\uDCC6',
      video: '\uD83C\uDFAC',
      audio: '\uD83C\uDFB5',
      other: '\uD83D\uDCC1',
    };
    return icons[type] || icons.other;
  },

  isPreviewable(type) {
    return ['markdown', 'image', 'pdf', 'video', 'audio'].includes(type);
  },
};

// Pagination helper
const Pagination = {
  getPage(entries, page, pageSize) {
    const start = (page - 1) * pageSize;
    return {
      items: entries.slice(start, start + pageSize),
      total: entries.length,
      page,
      pageSize,
      totalPages: Math.ceil(entries.length / pageSize),
    };
  },
};

// Search history manager
const SearchHistory = {
  KEY: 'knowledgeBaseSearchHistory',
  MAX_ITEMS: 10,

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  add(query) {
    if (!query || query.length < 2) return;
    const history = this.getHistory();
    // Remove duplicate
    const filtered = history.filter(h => h !== query);
    filtered.unshift(query);
    // Limit
    const trimmed = filtered.slice(0, this.MAX_ITEMS);
    localStorage.setItem(this.KEY, JSON.stringify(trimmed));
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};

// Sort helper
const Sorter = {
  sortByDate(entries, ascending = false) {
    return [...entries].sort((a, b) => {
      const da = a.createdAt || '';
      const db = b.createdAt || '';
      return ascending ? da.localeCompare(db) : db.localeCompare(da);
    });
  },

  sortByTitle(entries, ascending = true) {
    return [...entries].sort((a, b) => {
      return ascending
        ? a.title.localeCompare(b.title, 'zh-CN')
        : b.title.localeCompare(a.title, 'zh-CN');
    });
  },
};

// Skeleton loader
const Skeleton = {
  show(grid) {
    grid.innerHTML = Array.from({ length: 6 }, (_, i) => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-text"></div>
        <div class="skeleton-line skeleton-text-short"></div>
        <div class="skeleton-footer">
          <div class="skeleton-tags">
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
          </div>
          <div class="skeleton-date"></div>
        </div>
      </div>
    `).join('');
  },

  hide(grid) {
    const skeletons = grid.querySelectorAll('.skeleton-card');
    skeletons.forEach(el => el.remove());
  },
};
