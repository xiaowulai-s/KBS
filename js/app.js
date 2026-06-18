// ====================================
// app.js - Knowledge Base Main Application
// ====================================

const APP = {
  STORAGE_KEY: 'knowledgeBaseData',
  data: null,
  categories: new Set(),
  tags: new Set(),
  activeCategory: null,
  activeTag: null,
  searchQuery: '',
  searchIndex: null,
  nextId: 1,
  sortField: 'createdAt',
  sortDirection: 'desc',
  currentPage: 1,
  pageSize: 12,
  keyboardNavIndex: -1,
  searchHistoryDropdown: null,

  // Initialize
  async init() {
    Skeleton.show(document.getElementById('entryGrid'));
    await this.loadData();
    this.setupSearch();
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.renderFilters();
    this.renderCards();
    this.updateStats();
    this.updateBreadcrumb();
    Skeleton.hide(document.getElementById('entryGrid'));
  },

  // Load data from JSON or localStorage
  async loadData() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.data = JSON.parse(stored);
        this.rebuildMetadata();
        return;
      } catch (e) {
        console.warn('localStorage data corrupted, reloading from JSON');
      }
    }

    try {
      const resp = await fetch('data/index.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      this.data = await resp.json();
      this.rebuildMetadata();
      this.nextId = Math.max(...this.data.entries.map(e => e.id), 0) + 1;
      console.log('✅ Data loaded:', this.data.entries.length, 'entries');
    } catch (err) {
      console.error('❌ Failed to load data:', err);
      this.data = { version: '1.0.0', siteTitle: '知识库', entries: [] };
      this.rebuildMetadata();
    }
  },

  rebuildMetadata() {
    this.categories.clear();
    this.tags.clear();
    this.data.entries.forEach(entry => {
      this.categories.add(entry.category);
      entry.tags.forEach(tag => this.tags.add(tag));
    });
  },

  setupSearch() {
    if (typeof MiniSearch === 'undefined') {
      console.warn('MiniSearch not loaded, using basic filter');
      return;
    }
    this.searchIndex = new MiniSearch({
      fields: ['title', 'description', 'tags', 'category'],
      storeFields: ['title', 'description', 'tags', 'category', 'path', 'id', 'createdAt'],
      tokenize: (text) => text.split(/[\s\u3000,?;?.?:\-_\/\\]+/),
      searchOptions: {
        boost: { title: 3, description: 2, tags: 1.5, category: 1 },
      },
    });
    this.data.entries.forEach(entry => {
      this.searchIndex.add({
        id: entry.id,
        title: entry.title,
        description: entry.description || '',
        tags: entry.tags.join(' '),
        category: entry.category,
      });
    });
  },

  getFilteredEntries() {
    let entries = [...this.data.entries];

    if (this.activeCategory) {
      entries = entries.filter(e => e.category === this.activeCategory);
    }
    if (this.activeTag) {
      entries = entries.filter(e => e.tags.includes(this.activeTag));
    }
    if (this.searchQuery && this.searchIndex) {
      const results = this.searchIndex.search(this.searchQuery);
      const resultIds = new Set(results.map(r => r.id));
      entries = entries.filter(e => resultIds.has(e.id));
    } else if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      entries = entries.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort
    if (this.sortField === 'createdAt') {
      entries = Sorter.sortByDate(entries, this.sortDirection === 'asc');
    } else if (this.sortField === 'title') {
      entries = Sorter.sortByTitle(entries, this.sortDirection === 'asc');
    }

    return entries;
  },

  getPagedEntries() {
    const filtered = this.getFilteredEntries();
    return Pagination.getPage(filtered, this.currentPage, this.pageSize);
  },

  bindEvents() {
    // Search input with autocomplete
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    let debounceTimer;

    searchInput.addEventListener('focus', () => this.showSearchHistory(searchInput));
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value.trim();
      clearBtn.style.display = val ? 'block' : 'none';
      debounceTimer = setTimeout(() => {
        this.searchQuery = val;
        this.currentPage = 1;
        this.renderCards();
        this.updateStats();
        this.updateBreadcrumb();
      }, 200);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.blur();
        this.hideSearchHistory();
      }
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      this.searchQuery = '';
      this.currentPage = 1;
      this.renderCards();
      this.updateStats();
      this.updateBreadcrumb();
    });

    document.getElementById('addBtn').addEventListener('click', () => this.openForm());

    document.getElementById('adminToggleBtn').addEventListener('click', () => {
      const panel = document.getElementById('adminPanel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      if (panel.style.display === 'block') ADMIN.renderTable();
    });
    document.getElementById('closeAdmin').addEventListener('click', () => {
      document.getElementById('adminPanel').style.display = 'none';
    });

    document.getElementById('detailClose').addEventListener('click', () => this.closeDetail());
    document.getElementById('detailOverlay').addEventListener('click', () => this.closeDetail());

    document.getElementById('formClose').addEventListener('click', () => this.closeForm());
    document.getElementById('formOverlay').addEventListener('click', () => this.closeForm());
    document.getElementById('formCancel').addEventListener('click', () => this.closeForm());

    document.getElementById('entryForm').addEventListener('submit', (e) => this.handleFormSubmit(e));

    document.getElementById('exportBtn').addEventListener('click', () => ADMIN.exportJSON());
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', (e) => ADMIN.importJSON(e));

    // Sort controls
    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => this.toggleSort());
    }
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // ESC to close modals
      if (e.key === 'Escape') {
        const detailModal = document.getElementById('detailModal');
        const formModal = document.getElementById('formModal');
        const adminPanel = document.getElementById('adminPanel');

        if (detailModal.style.display !== 'none') {
          this.closeDetail();
        } else if (formModal.style.display !== 'none') {
          this.closeForm();
        } else if (adminPanel.style.display !== 'none') {
          adminPanel.style.display = 'none';
        }
      }

      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }

      // Arrow keys for card navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const cards = document.querySelectorAll('.entry-card');
        if (cards.length === 0) return;

        e.preventDefault();
        if (e.key === 'ArrowDown') {
          this.keyboardNavIndex = Math.min(this.keyboardNavIndex + 1, cards.length - 1);
        } else {
          this.keyboardNavIndex = Math.max(this.keyboardNavIndex - 1, 0);
        }
        cards.forEach((c, i) => c.classList.toggle('keyboard-focus', i === this.keyboardNavIndex));
        if (this.keyboardNavIndex >= 0) {
          cards[this.keyboardNavIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      // Enter to open selected card
      if (e.key === 'Enter' && this.keyboardNavIndex >= 0) {
        const cards = document.querySelectorAll('.entry-card');
        if (cards[this.keyboardNavIndex]) {
          cards[this.keyboardNavIndex].click();
        }
      }
    });
  },

  renderFilters() {
    const catContainer = document.getElementById('categoryFilters');
    const tagContainer = document.getElementById('tagFilters');

    catContainer.innerHTML = '';
    const catAllBtn = document.createElement('button');
    catAllBtn.className = 'filter-tag' + (!this.activeCategory ? ' active' : '');
    catAllBtn.textContent = '全部';
    catAllBtn.addEventListener('click', () => {
      this.activeCategory = null;
      this.renderFilters();
      this.renderCards();
      this.updateStats();
      this.updateBreadcrumb();
    });
    catContainer.appendChild(catAllBtn);

    [...this.categories].sort().forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-tag' + (this.activeCategory === cat ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        this.activeCategory = this.activeCategory === cat ? null : cat;
        this.currentPage = 1;
        this.renderFilters();
        this.renderCards();
        this.updateStats();
        this.updateBreadcrumb();
      });
      catContainer.appendChild(btn);
    });

    tagContainer.innerHTML = '';
    const tagAllBtn = document.createElement('button');
    tagAllBtn.className = 'filter-tag' + (!this.activeTag ? ' active' : '');
    tagAllBtn.textContent = '全部';
    tagAllBtn.addEventListener('click', () => {
      this.activeTag = null;
      this.renderFilters();
      this.renderCards();
      this.updateStats();
      this.updateBreadcrumb();
    });
    tagContainer.appendChild(tagAllBtn);

    [...this.tags].sort().forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'filter-tag' + (this.activeTag === tag ? ' active' : '');
      btn.textContent = '#' + tag;
      btn.addEventListener('click', () => {
        this.activeTag = this.activeTag === tag ? null : tag;
        this.currentPage = 1;
        this.renderFilters();
        this.renderCards();
        this.updateStats();
        this.updateBreadcrumb();
      });
      tagContainer.appendChild(btn);
    });
  },

  renderCards() {
    const grid = document.getElementById('entryGrid');
    const empty = document.getElementById('emptyState');
    const paged = this.getPagedEntries();
    const entries = paged.items;

    if (entries.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      this.renderPagination(null);
      return;
    }

    empty.style.display = 'none';
    grid.innerHTML = entries.map(entry => {
      const fileType = FileType.detect(entry.path);
      const icon = FileType.getIcon(fileType);
      return `
        <div class="entry-card" data-id="${entry.id}" tabindex="0" role="button" aria-label="${this.escapeHtml(entry.title)}">
          <div class="card-header">
            <span class="card-icon">${icon}</span>
            <span class="card-title">${this.highlightText(entry.title)}</span>
            <span class="card-category">${this.escapeHtml(entry.category)}</span>
          </div>
          <p class="card-desc">${this.highlightText(entry.description || '暂无描述')}</p>
          <div class="card-footer">
            <div class="card-tags">
              ${entry.tags.map(t => `<span class="card-tag">#${this.highlightText(t)}</span>`).join('')}
            </div>
            <span class="card-date">${entry.createdAt || ''}</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.entry-card').forEach((card, index) => {
      card.addEventListener('click', () => this.openDetail(parseInt(card.dataset.id)));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openDetail(parseInt(card.dataset.id));
        }
      });
    });

    this.renderPagination(paged);
  },

  highlightText(text) {
    if (!this.searchQuery || !text) return this.escapeHtml(text);
    return SearchHighlight.highlight(text, this.searchQuery);
  },

  renderPagination(paged) {
    let pager = document.getElementById('pagination');
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'pagination';
      pager.className = 'pagination';
      document.querySelector('main').appendChild(pager);
    }

    if (!paged || paged.totalPages <= 1) {
      pager.innerHTML = '';
      return;
    }

    let html = `<span class="page-info">第 ${paged.page}/${paged.totalPages} 页</span>`;

    // Previous
    html += `<button class="page-btn ${paged.page === 1 ? 'disabled' : ''}" data-page="${paged.page - 1}">‹</button>`;

    // Page numbers
    const maxButtons = 5;
    let startPage = Math.max(1, paged.page - Math.floor(maxButtons / 2));
    let endPage = Math.min(paged.totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
      html += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === paged.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < paged.totalPages) {
      if (endPage < paged.totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
      html += `<button class="page-btn" data-page="${paged.totalPages}">${paged.totalPages}</button>`;
    }

    // Next
    html += `<button class="page-btn ${paged.page === paged.totalPages ? 'disabled' : ''}" data-page="${paged.page + 1}">›</button>`;

    pager.innerHTML = html;

    pager.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.renderCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  },

  toggleSort() {
    if (this.sortField === 'createdAt') {
      this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortField = 'createdAt';
      this.sortDirection = 'desc';
    }
    this.currentPage = 1;
    this.renderCards();
    this.updateStats();
  },

  showSearchHistory(input) {
    this.hideSearchHistory();
    const history = SearchHistory.getHistory();
    if (history.length === 0) return;

    this.searchHistoryDropdown = document.createElement('div');
    this.searchHistoryDropdown.className = 'search-history-dropdown';
    this.searchHistoryDropdown.innerHTML = `
      <div class="search-history-header">
        <span>搜索历史</span>
        <button class="btn-clear-history" onclick="SearchHistory.clear();APP.hideSearchHistory();">清空</button>
      </div>
      ${history.slice(0, 5).map(h => `<div class="search-history-item">${APP.escapeHtml(h)}</div>`).join('')}
    `;

    input.parentNode.appendChild(this.searchHistoryDropdown);

    this.searchHistoryDropdown.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.textContent;
        this.searchQuery = item.textContent.trim();
        this.currentPage = 1;
        SearchHistory.add(this.searchQuery);
        this.renderCards();
        this.updateStats();
        this.updateBreadcrumb();
        this.hideSearchHistory();
      });
    });
  },

  hideSearchHistory() {
    if (this.searchHistoryDropdown) {
      this.searchHistoryDropdown.remove();
      this.searchHistoryDropdown = null;
    }
  },

  openDetail(id) {
    const entry = this.data.entries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('detailTitle').textContent = entry.title;
    document.getElementById('detailCategory').textContent = entry.category;
    document.getElementById('detailTags').innerHTML = entry.tags.map(t =>
      `<span class="card-tag">#${this.escapeHtml(t)}</span>`
    ).join(' ');
    document.getElementById('detailDate').textContent = entry.createdAt || '-';
    document.getElementById('detailDesc').textContent = entry.description || '暂无描述';

    const preview = document.getElementById('detailPreview');
    const fileType = FileType.detect(entry.path);

    if (entry.path && FileType.isPreviewable(fileType)) {
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
      const fullPath = basePath + entry.path;

      if (fileType === 'markdown') {
        fetch(fullPath)
          .then(r => {
            if (!r.ok) throw new Error('Not found');
            return r.text();
          })
          .then(text => {
            preview.innerHTML = marked.parse(text);
          })
          .catch(() => {
            preview.innerHTML = '<p style="color:var(--text-secondary)">文件不存在或无法加载</p>';
          });
      } else if (fileType === 'image') {
        preview.innerHTML = `
          <img src="${this.escapeHtml(fullPath)}" alt="${this.escapeHtml(entry.title)}" style="max-width:100%;border-radius:var(--radius);">
        `;
      } else if (fileType === 'pdf') {
        preview.innerHTML = `
          <iframe src="${this.escapeHtml(fullPath)}" style="width:100%;height:600px;border:none;border-radius:var(--radius);">
            <a href="${this.escapeHtml(fullPath)}" target="_blank">点击下载 PDF 文件</a>
          </iframe>
        `;
      } else if (fileType === 'video') {
        preview.innerHTML = `
          <video controls style="max-width:100%;border-radius:var(--radius);">
            <source src="${this.escapeHtml(fullPath)}" type="video/${entry.path.split('.').pop()}">
            您的浏览器不支持视频预览，<a href="${this.escapeHtml(fullPath)}">点击下载</a>
          </video>
        `;
      } else if (fileType === 'audio') {
        preview.innerHTML = `
          <audio controls style="width:100%;">
            <source src="${this.escapeHtml(fullPath)}" type="audio/${entry.path.split('.').pop()}">
            您的浏览器不支持音频预览，<a href="${this.escapeHtml(fullPath)}">点击下载</a>
          </audio>
        `;
      }
    } else {
      preview.innerHTML = '<p style="color:var(--text-secondary)">暂不支持预览此文件类型</p>';
    }

    document.getElementById('detailModal').style.display = 'flex';
    this.keyboardNavIndex = -1;
  },

  closeDetail() {
    document.getElementById('detailModal').style.display = 'none';
  },

  openForm(entry = null) {
    const modal = document.getElementById('formModal');
    const titleEl = document.getElementById('formTitleText');

    const select = document.getElementById('formCategory');
    select.innerHTML = '<option value="">请选择分类</option>';
    [...this.categories].sort().forEach(c => {
      select.innerHTML += `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`;
    });

    if (entry) {
      titleEl.textContent = '编辑文件';
      document.getElementById('editId').value = entry.id;
      select.value = entry.category;
      document.getElementById('formTags').value = entry.tags.join(', ');
      document.getElementById('formPath').value = entry.path || '';
      document.getElementById('formDesc').value = entry.description || '';
      document.getElementById('formCategoryNew').value = '';
    } else {
      titleEl.textContent = '添加文件';
      document.getElementById('editId').value = '';
      document.getElementById('formTitle').value = '';
      select.value = '';
      document.getElementById('formTags').value = '';
      document.getElementById('formPath').value = '';
      document.getElementById('formDesc').value = '';
      document.getElementById('formCategoryNew').value = '';
    }

    modal.style.display = 'flex';
  },

  closeForm() {
    document.getElementById('formModal').style.display = 'none';
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const titleInput = document.getElementById('formTitle');
    const categorySelect = document.getElementById('formCategory');
    const categoryNew = document.getElementById('formCategoryNew');
    const tagsInput = document.getElementById('formTags');
    const pathInput = document.getElementById('formPath');
    const descInput = document.getElementById('formDesc');

    const category = categoryNew.value.trim() || categorySelect.value;
    if (!category) { Toast.warning('请选择或输入分类'); return; }

    const tags = tagsInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    const path = pathInput.value.trim();
    const description = descInput.value.trim();

    if (editId) {
      const entry = this.data.entries.find(en => en.id === parseInt(editId));
      if (entry) {
        const oldCat = entry.category;
        entry.title = titleInput.value.trim();
        entry.category = category;
        entry.tags = tags;
        entry.path = path;
        entry.description = description;
        if (oldCat !== category) this.categories.delete(oldCat);
      }
    } else {
      this.data.entries.push({
        id: this.nextId++,
        title: titleInput.value.trim(),
        category: category,
        tags: tags,
        path: path,
        description: description,
        createdAt: new Date().toISOString().slice(0, 10),
        type: FileType.detect(path),
      });
    }

    this.categories.add(category);
    tags.forEach(t => this.tags.add(t));

    this.setupSearch();
    this.saveData();
    this.renderFilters();
    this.renderCards();
    this.updateStats();
    this.updateBreadcrumb();
    this.closeForm();
    Toast.success(editId ? '更新成功' : '添加成功');

    if (document.getElementById('adminPanel').style.display !== 'none') {
      ADMIN.renderTable();
    }
  },

  saveData() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  },

  updateStats() {
    const total = this.data.entries.length;
    const filtered = this.getFilteredEntries().length;
    const paged = this.getPagedEntries();
    document.querySelector('#totalCount strong').textContent = total;
    document.querySelector('#filteredCount strong').textContent = `${paged.total} / ${filtered}`;
  },

  updateBreadcrumb() {
    let breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) {
      breadcrumb = document.createElement('div');
      breadcrumb.id = 'breadcrumb';
      breadcrumb.className = 'breadcrumb';
      document.querySelector('.search-section .container').appendChild(breadcrumb);
    }

    const parts = [];
    if (this.searchQuery) parts.push(`搜索: "${this.searchQuery}"`);
    if (this.activeCategory) parts.push(`分类: ${this.activeCategory}`);
    if (this.activeTag) parts.push(`标签: #${this.activeTag}`);

    if (parts.length === 0) {
      breadcrumb.innerHTML = '';
      return;
    }

    breadcrumb.innerHTML = `
      <span class="breadcrumb-text">${parts.join(' &gt; ')}</span>
      <button class="btn-clear-filters" onclick="APP.clearFilters()">清除筛选</button>
    `;
  },

  clearFilters() {
    this.activeCategory = null;
    this.activeTag = null;
    this.searchQuery = '';
    this.currentPage = 1;
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    this.renderFilters();
    this.renderCards();
    this.updateStats();
    this.updateBreadcrumb();
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};

// Start app
document.addEventListener('DOMContentLoaded', () => APP.init());
