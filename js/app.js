const APP = {
  STORAGE_KEY: "knowledgeBaseData",
  data: null,
  categories: new Set(),
  tags: new Set(),
  activeCategory: null,
  activeTag: null,
  searchQuery: "",
  searchIndex: null,
  nextId: 1,
  sortField: "createdAt",
  sortDirection: "desc",
  currentPage: 1,
  pageSize: 12,
  keyboardNavIndex: -1,
  favorites: new Set(),
  showFavoritesOnly: false,
  batchMode: false,
  selectedIds: new Set(),

  async init() {
    this.registerSW();
    Skeleton.show(document.getElementById("entryGrid"));
    await this.loadData();
    this.loadUrlState();
    this.setupOfflineDetection();
    this.loadFavorites();
    this.setupSearch();
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.renderSidebar();
    this.renderCards();
    this.updateStats();
    this.renderActiveFilters();
    this.initTheme();
    lucide.createIcons();
    Skeleton.hide(document.getElementById("entryGrid"));
  },

  async loadData() {
    try {
      const resp = await fetch("data/index.json?v=" + Date.now());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      this.data = await resp.json();
      this.rebuildMetadata();
      this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
      const ids = this.data.entries.map((e) => e.id);
      const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
      if (dupes.length > 0) {
        console.warn("Duplicate IDs detected:", [...new Set(dupes)]);
        const usedIds = new Set();
        this.data.entries.forEach((entry) => {
          if (usedIds.has(entry.id)) {
            entry.id = this.nextId++;
          }
          usedIds.add(entry.id);
        });
        this.rebuildMetadata();
      }
      console.log("Data loaded:", this.data.entries.length, "entries");
    } catch (err) {
      console.error("Failed to load data:", err);
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          this.data = JSON.parse(stored);
          this.rebuildMetadata();
          this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
          console.warn("Loaded from localStorage fallback");
          return;
        } catch (e) {
          console.warn("localStorage corrupted");
        }
      }
      this.data = { version: "1.0.0", siteTitle: "知识库", entries: [] };
      this.rebuildMetadata();
    }
  },

  rebuildMetadata() {
    this.categories.clear();
    this.tags.clear();
    this.data.entries.forEach((entry) => {
      this.categories.add(entry.category);
      entry.tags.forEach((tag) => this.tags.add(tag));
    });
  },

  setupSearch() {
    if (typeof MiniSearch === "undefined") {
      console.warn("MiniSearch not loaded, using basic filter");
      return;
    }
    this.searchIndex = new MiniSearch({
      fields: ["title", "description", "tags", "category"],
      storeFields: [
        "title",
        "description",
        "tags",
        "category",
        "path",
        "id",
        "createdAt",
      ],
      tokenize: (text) => {
        let tokens = text.split(/[\s\u3000,?;?.?:\-_\/\\]+/);
        const chineseChars = text.match(/[\u4e00-\u9fff]/g);
        if (chineseChars && chineseChars.length > 1) {
          const bigrams = [];
          for (let i = 0; i < chineseChars.length - 1; i++) {
            bigrams.push(chineseChars[i] + chineseChars[i + 1]);
          }
          tokens = [...tokens, ...bigrams];
        }
        return tokens.filter((t) => t.length > 0);
      },
      searchOptions: {
        boost: { title: 3, description: 2, tags: 1.5, category: 1 },
      },
    });
    this.data.entries.forEach((entry) => {
      this.searchIndex.add({
        id: entry.id,
        title: entry.title,
        description: entry.description || "",
        tags: entry.tags.join(" "),
        category: entry.category,
      });
    });
  },

  getFilteredEntries() {
    let entries = [...this.data.entries];
    if (this.showFavoritesOnly) {
      entries = entries.filter((e) => this.favorites.has(e.id));
    }
    if (this.activeCategory) {
      entries = entries.filter((e) => e.category === this.activeCategory);
    }
    if (this.activeTag) {
      entries = entries.filter((e) => e.tags.includes(this.activeTag));
    }
    if (this.searchQuery && this.searchIndex) {
      const results = this.searchIndex.search(this.searchQuery);
      const resultIds = new Set(results.map((r) => r.id));
      entries = entries.filter((e) => resultIds.has(e.id));
    } else if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (this.sortField === "createdAt") {
      entries = Sorter.sortByDate(entries, this.sortDirection === "asc");
    } else if (this.sortField === "title") {
      entries = Sorter.sortByTitle(entries, this.sortDirection === "asc");
    }
    return entries;
  },

  getPagedEntries() {
    return Pagination.getPage(
      this.getFilteredEntries(),
      this.currentPage,
      this.pageSize,
    );
  },

  renderSidebar() {
    const catContainer = document.getElementById("sidebarCategories");
    const tagContainer = document.getElementById("sidebarTags");
    const favBtn = document.getElementById("sidebarFavoritesBtn");
    const favCount = document.getElementById("sidebarFavCount");

    if (favBtn) {
      favBtn.style.display = this.favorites.size > 0 ? "flex" : "none";
      if (favCount) favCount.textContent = this.favorites.size;
    }

    catContainer.innerHTML = "";
    const catAll = document.createElement("button");
    catAll.className =
      "sidebar-tree-item" +
      (!this.activeCategory && !this.showFavoritesOnly ? " active" : "");
    catAll.innerHTML = `<i data-lucide="layers" class="sidebar-tree-icon"></i><span>全部分类</span><span class="sidebar-item-count">${this.data.entries.length}</span>`;
    catAll.addEventListener("click", () => {
      this.activeCategory = null;
      this.showFavoritesOnly = false;
      this.currentPage = 1;
      this.renderSidebar();
      this.renderCards();
      this.updateStats();
      this.renderActiveFilters();
    });
    catContainer.appendChild(catAll);

    [...this.categories].sort().forEach((cat) => {
      const count = this.data.entries.filter((e) => e.category === cat).length;
      const btn = document.createElement("button");
      btn.className =
        "sidebar-tree-item" + (this.activeCategory === cat ? " active" : "");
      btn.innerHTML = `<i data-lucide="folder" class="sidebar-tree-icon"></i><span>${this.escapeHtml(cat)}</span><span class="sidebar-item-count">${count}</span>`;
      btn.addEventListener("click", () => {
        this.activeCategory = this.activeCategory === cat ? null : cat;
        this.showFavoritesOnly = false;
        this.currentPage = 1;
        this.renderSidebar();
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
      });
      catContainer.appendChild(btn);
    });

    tagContainer.innerHTML = "";
    [...this.tags].sort().forEach((tag) => {
      const btn = document.createElement("button");
      btn.className = "sidebar-tag" + (this.activeTag === tag ? " active" : "");
      btn.textContent = "#" + tag;
      btn.addEventListener("click", () => {
        this.activeTag = this.activeTag === tag ? null : tag;
        this.showFavoritesOnly = false;
        this.currentPage = 1;
        this.renderSidebar();
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
      });
      tagContainer.appendChild(btn);
    });

    lucide.createIcons();
  },

  renderCards() {
    const grid = document.getElementById("entryGrid");
    const empty = document.getElementById("emptyState");
    const paged = this.getPagedEntries();
    const entries = paged.items;

    if (entries.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "block";
      this.renderPagination(null);
      return;
    }

    empty.style.display = "none";
    this.keyboardNavIndex = -1;

    grid.innerHTML = entries
      .map((entry, idx) => {
        const fileType = FileType.detect(entry.path);
        const iconName = this.getLucideIcon(fileType);
        const isFav = this.isFavorite(entry.id);
        const batchCheck = this.batchMode
          ? `<input type="checkbox" class="batch-checkbox" data-id="${entry.id}" onclick="event.stopPropagation();" onchange="APP.toggleBatchSelect(${entry.id}, this.checked)" ${this.selectedIds.has(entry.id) ? "checked" : ""}>`
          : "";
        return `
        <div class="entry-card" data-id="${entry.id}" tabindex="0" role="button" aria-label="${this.escapeHtml(entry.title)}" style="animation-delay:${(idx % 12) * 50}ms">
          ${batchCheck}
          <div class="card-thumb">
            <div class="card-thumb-bar"></div>
            <i data-lucide="${iconName}" class="card-thumb-icon"></i>
          </div>
          <div class="card-header">
            <span class="card-title">${this.highlightText(entry.title)}</span>
            <span class="card-category"><i data-lucide="folder"></i>${this.escapeHtml(entry.category)}</span>
          </div>
          <div class="card-meta">
            <span>${entry.createdAt || ""}</span>
          </div>
          <p class="card-desc">${this.highlightText(entry.description || "暂无描述")}</p>
          <div class="card-footer">
            <div class="card-tags">
              ${entry.tags.map((t) => `<span class="card-tag">#${this.highlightText(t)}</span>`).join("")}
            </div>
            <div class="card-actions">
              <button class="fav-btn ${isFav ? "favorited" : ""}" data-id="${entry.id}" title="收藏" onclick="event.stopPropagation();APP.toggleFavorite(${entry.id})">
                ${isFav ? "★" : "☆"}
              </button>
            </div>
          </div>
        </div>`;
      })
      .join("");

    grid.querySelectorAll(".entry-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.type === "checkbox") return;
        this.openDrawer(parseInt(card.dataset.id));
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.openDrawer(parseInt(card.dataset.id));
        }
      });
    });

    this.renderPagination(paged);
    this.updateUrlState();
    lucide.createIcons();
  },

  getLucideIcon(type) {
    const map = {
      markdown: "file-text",
      image: "image",
      pdf: "file-text",
      video: "video",
      audio: "music",
      other: "file",
    };
    return map[type] || "file";
  },

  highlightText(text) {
    if (!this.searchQuery || !text) return this.escapeHtml(text);
    return SearchHighlight.highlight(text, this.searchQuery);
  },

  renderPagination(paged) {
    const pager = document.getElementById("pagination");
    if (!pager) return;

    if (!paged || paged.totalPages <= 1) {
      pager.innerHTML = "";
      return;
    }

    let html = `<span class="page-info">第 ${paged.page}/${paged.totalPages} 页</span>`;
    html += `<button class="page-btn ${paged.page === 1 ? "disabled" : ""}" data-page="${paged.page - 1}">‹</button>`;

    const maxButtons = 5;
    let startPage = Math.max(1, paged.page - Math.floor(maxButtons / 2));
    let endPage = Math.min(paged.totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
      html += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2)
        html += `<span style="padding:0 4px;color:var(--text-tertiary)">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="page-btn ${i === paged.page ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    if (endPage < paged.totalPages) {
      if (endPage < paged.totalPages - 1)
        html += `<span style="padding:0 4px;color:var(--text-tertiary)">...</span>`;
      html += `<button class="page-btn" data-page="${paged.totalPages}">${paged.totalPages}</button>`;
    }
    html += `<button class="page-btn ${paged.page === paged.totalPages ? "disabled" : ""}" data-page="${paged.page + 1}">›</button>`;

    pager.innerHTML = html;
    pager.querySelectorAll(".page-btn:not(.disabled)").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.renderCards();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  },

  toggleSort() {
    if (this.sortField === "createdAt") {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
    } else {
      this.sortField = "createdAt";
      this.sortDirection = "desc";
    }
    this.currentPage = 1;
    this.renderCards();
    this.updateStats();
  },

  bindEvents() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    const clearBtn = document.getElementById("clearSearch");
    const searchPanel = document.getElementById("searchPanel");
    let debounceTimer;

    searchInput.addEventListener("focus", () => {
      if (searchPanel && this.searchQuery.length > 0) {
        searchPanel.style.display = "block";
      }
    });

    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value.trim();
      if (clearBtn) clearBtn.style.display = val ? "flex" : "none";
      debounceTimer = setTimeout(() => {
        this.searchQuery = val;
        this.currentPage = 1;
        SearchHistory.add(val);
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
        this.renderSidebar();
        if (searchPanel && val.length > 0) {
          searchPanel.style.display = "block";
          this.renderSearchSuggestions(val);
        } else if (searchPanel) {
          searchPanel.style.display = "none";
        }
      }, 200);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchInput.blur();
        if (searchPanel) searchPanel.style.display = "none";
      }
    });

    document.addEventListener("click", (e) => {
      if (
        searchPanel &&
        !e.target.closest(".topbar-search") &&
        !e.target.closest(".search-panel")
      ) {
        searchPanel.style.display = "none";
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        this.searchQuery = "";
        this.currentPage = 1;
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
        this.renderSidebar();
        if (searchPanel) searchPanel.style.display = "none";
      });
    }

    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });
      document.addEventListener("click", (e) => {
        if (
          window.innerWidth <= 768 &&
          sidebar.classList.contains("open") &&
          !sidebar.contains(e.target) &&
          !sidebarToggle.contains(e.target)
        ) {
          sidebar.classList.remove("open");
        }
      });
    }

    // Batch buttons
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");
    if (batchDeleteBtn)
      batchDeleteBtn.addEventListener("click", () => this.batchDelete());
    const batchMoveBtn = document.getElementById("batchMoveBtn");
    if (batchMoveBtn)
      batchMoveBtn.addEventListener("click", () => this.batchMoveCategory());
    const batchCancelBtn = document.getElementById("batchCancelBtn");
    if (batchCancelBtn) {
      batchCancelBtn.addEventListener("click", () => {
        this.batchMode = false;
        this.selectedIds.clear();
        document.getElementById("batchToolbar").style.display = "none";
        this.renderCards();
      });
    }

    const addBtn = document.getElementById("addBtn");
    if (addBtn) addBtn.addEventListener("click", () => this.openForm());

    const adminToggleBtn = document.getElementById("adminToggleBtn");
    if (adminToggleBtn) {
      adminToggleBtn.addEventListener("click", () => {
        const panel = document.getElementById("adminPanel");
        if (panel) {
          panel.style.display =
            panel.style.display === "none" ? "block" : "none";
          if (panel.style.display === "block") ADMIN.renderTable();
        }
      });
    }
    const closeAdminBtn = document.getElementById("closeAdmin");
    if (closeAdminBtn) {
      closeAdminBtn.addEventListener("click", () => {
        document.getElementById("adminPanel").style.display = "none";
      });
    }

    // Drawer events
    const drawerOverlay = document.getElementById("drawerOverlay");
    const drawerClose = document.getElementById("drawerClose");
    if (drawerOverlay)
      drawerOverlay.addEventListener("click", () => this.closeDrawer());
    if (drawerClose)
      drawerClose.addEventListener("click", () => this.closeDrawer());

    const drawerFavBtn = document.getElementById("drawerFavBtn");
    if (drawerFavBtn)
      drawerFavBtn.addEventListener("click", () => this.drawerToggleFav());

    const drawerEditBtn = document.getElementById("drawerEditBtn");
    if (drawerEditBtn)
      drawerEditBtn.addEventListener("click", () => this.drawerEdit());

    const drawerDownloadBtn = document.getElementById("drawerDownloadBtn");
    if (drawerDownloadBtn)
      drawerDownloadBtn.addEventListener("click", () => this.drawerDownload());

    const drawerDeleteBtn = document.getElementById("drawerDeleteBtn");
    if (drawerDeleteBtn)
      drawerDeleteBtn.addEventListener("click", () => this.drawerDelete());

    // Form events
    const formClose = document.getElementById("formClose");
    if (formClose) formClose.addEventListener("click", () => this.closeForm());
    const formOverlay = document.getElementById("formOverlay");
    if (formOverlay)
      formOverlay.addEventListener("click", () => this.closeForm());
    const formCancel = document.getElementById("formCancel");
    if (formCancel)
      formCancel.addEventListener("click", () => this.closeForm());
    const form = document.getElementById("entryForm");
    if (form) form.addEventListener("submit", (e) => this.handleFormSubmit(e));

    const sortBtn = document.getElementById("sortBtn");
    if (sortBtn) sortBtn.addEventListener("click", () => this.toggleSort());

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle)
      themeToggle.addEventListener("click", () => this.toggleTheme());

    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn)
      exportBtn.addEventListener("click", () => ADMIN.exportJSON());
    const importBtn = document.getElementById("importBtn");
    if (importBtn)
      importBtn.addEventListener("click", () =>
        document.getElementById("importFileInput").click(),
      );
    const importFileInput = document.getElementById("importFileInput");
    if (importFileInput)
      importFileInput.addEventListener("change", (e) => ADMIN.importJSON(e));

    // Sidebar favorites
    const sidebarFavBtn = document.getElementById("sidebarFavoritesBtn");
    if (sidebarFavBtn) {
      sidebarFavBtn.addEventListener("click", () => {
        this.showFavoritesOnly = !this.showFavoritesOnly;
        this.activeCategory = null;
        this.activeTag = null;
        this.currentPage = 1;
        this.renderSidebar();
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
        Toast.info(this.showFavoritesOnly ? "仅显示收藏" : "显示全部");
      });
    }
  },

  renderSearchSuggestions(query) {
    const container = document.getElementById("searchSuggestions");
    if (!container) return;
    if (!this.searchIndex) {
      container.innerHTML = "";
      return;
    }
    const results = this.searchIndex.search(query, {
      prefix: true,
      fuzzy: 0.2,
    });
    const top = results.slice(0, 5);
    if (top.length === 0) {
      container.innerHTML = `<div class="search-suggestion" style="color:var(--text-tertiary);font-size:13px;padding:12px 16px;">未找到相关结果</div>`;
      return;
    }
    container.innerHTML = top
      .map((r) => {
        const entry = this.data.entries.find((e) => e.id === r.id);
        if (!entry) return "";
        return `<div class="search-suggestion" data-id="${entry.id}">
        <i data-lucide="file-text" class="search-suggestion-icon"></i>
        <span class="search-suggestion-text">${this.escapeHtml(entry.title)}</span>
        <span class="search-suggestion-hint">${this.escapeHtml(entry.category)}</span>
      </div>`;
      })
      .join("");
    container.querySelectorAll(".search-suggestion").forEach((el) => {
      el.addEventListener("click", () => {
        document.getElementById("searchPanel").style.display = "none";
        this.openDrawer(parseInt(el.dataset.id));
      });
    });
    lucide.createIcons();
  },

  renderActiveFilters() {
    const container = document.getElementById("activeFilters");
    if (!container) return;
    const parts = [];
    if (this.searchQuery)
      parts.push({ type: "search", label: `"${this.searchQuery}"` });
    if (this.activeCategory)
      parts.push({ type: "category", label: `分类: ${this.activeCategory}` });
    if (this.activeTag)
      parts.push({ type: "tag", label: `#${this.activeTag}` });
    if (this.showFavoritesOnly) parts.push({ type: "fav", label: "★ 收藏" });

    if (parts.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    container.innerHTML =
      parts
        .map(
          (p) =>
            `<span class="active-filter">
        ${p.label}
        <button class="active-filter-remove" data-type="${p.type}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
      </span>`,
        )
        .join("") + `<button class="active-filter-clear">清除全部</button>`;

    container.querySelectorAll(".active-filter-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        if (type === "search") {
          this.searchQuery = "";
          document.getElementById("searchInput").value = "";
          document.getElementById("clearSearch").style.display = "none";
        }
        if (type === "category") this.activeCategory = null;
        if (type === "tag") this.activeTag = null;
        if (type === "fav") this.showFavoritesOnly = false;
        this.currentPage = 1;
        this.renderSidebar();
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
      });
    });
    container
      .querySelector(".active-filter-clear")
      .addEventListener("click", () => {
        this.searchQuery = "";
        this.activeCategory = null;
        this.activeTag = null;
        this.showFavoritesOnly = false;
        document.getElementById("searchInput").value = "";
        document.getElementById("clearSearch").style.display = "none";
        this.currentPage = 1;
        this.renderSidebar();
        this.renderCards();
        this.updateStats();
        this.renderActiveFilters();
      });
    lucide.createIcons();
  },

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const drawer = document.getElementById("drawer");
        const formModal = document.getElementById("formModal");
        const adminPanel = document.getElementById("adminPanel");
        if (drawer.style.display !== "none") {
          this.closeDrawer();
        } else if (formModal.style.display !== "none") {
          this.closeForm();
        } else if (adminPanel.style.display !== "none") {
          adminPanel.style.display = "none";
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("searchInput").focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const cards = document.querySelectorAll(".entry-card");
        if (cards.length === 0) return;
        e.preventDefault();
        if (e.key === "ArrowDown") {
          this.keyboardNavIndex = Math.min(
            this.keyboardNavIndex + 1,
            cards.length - 1,
          );
        } else {
          this.keyboardNavIndex = Math.max(this.keyboardNavIndex - 1, 0);
        }
        cards.forEach((c, i) =>
          c.classList.toggle("keyboard-focus", i === this.keyboardNavIndex),
        );
        if (this.keyboardNavIndex >= 0) {
          cards[this.keyboardNavIndex].scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }
      if (e.key === "Enter" && this.keyboardNavIndex >= 0) {
        const cards = document.querySelectorAll(".entry-card");
        if (cards[this.keyboardNavIndex]) cards[this.keyboardNavIndex].click();
      }
    });
  },

  openDrawer(id) {
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;

    document.getElementById("drawerTitle").textContent = entry.title;
    document.getElementById("drawerCategory").innerHTML =
      `<i data-lucide="folder" style="width:12px;height:12px;"></i> ${this.escapeHtml(entry.category)}`;
    document.getElementById("drawerDate").textContent = entry.createdAt || "-";
    document.getElementById("drawerTags").innerHTML = entry.tags
      .map((t) => `<span class="card-tag">#${this.escapeHtml(t)}</span>`)
      .join(" ");
    document.getElementById("drawerDesc").textContent =
      entry.description || "暂无描述";
    document.getElementById("drawerFavBtn").innerHTML = this.isFavorite(
      entry.id,
    )
      ? '<i data-lucide="star" style="fill:var(--accent);color:var(--accent);"></i>'
      : '<i data-lucide="star"></i>';

    const preview = document.getElementById("drawerPreview");
    const fileType = FileType.detect(entry.path);

    if (entry.path && FileType.isPreviewable(fileType)) {
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, "/");
      const fullPath = basePath + entry.path;

      if (fileType === "markdown") {
        preview.innerHTML =
          '<div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div>';
        fetch(fullPath, { cache: "no-store" })
          .then((r) => {
            if (!r.ok) throw new Error("Not found");
            return r.text();
          })
          .then((text) => {
            if (typeof marked !== "undefined") {
              preview.innerHTML = marked.parse(text);
            } else {
              preview.innerHTML = `<pre style="white-space:pre-wrap;">${this.escapeHtml(text)}</pre>`;
            }
          })
          .catch(() => {
            preview.innerHTML =
              '<p style="color:var(--text-secondary)">文件不存在或无法加载</p>';
          });
      } else if (fileType === "image") {
        preview.innerHTML = `<img src="${this.escapeHtml(fullPath)}" alt="${this.escapeHtml(entry.title)}" style="max-width:100%;border-radius:var(--radius);">`;
      } else if (fileType === "pdf") {
        preview.innerHTML = `<iframe src="${this.escapeHtml(fullPath)}" style="width:100%;height:600px;border:none;border-radius:var(--radius);"><a href="${this.escapeHtml(fullPath)}" target="_blank">下载 PDF</a></iframe>`;
      } else if (fileType === "video") {
        preview.innerHTML = `<video controls style="max-width:100%;border-radius:var(--radius);"><source src="${this.escapeHtml(fullPath)}" type="video/${entry.path.split(".").pop()}">不支持视频预览，<a href="${this.escapeHtml(fullPath)}">点击下载</a></video>`;
      } else if (fileType === "audio") {
        preview.innerHTML = `<audio controls style="width:100%;"><source src="${this.escapeHtml(fullPath)}" type="audio/${entry.path.split(".").pop()}">不支持音频预览，<a href="${this.escapeHtml(fullPath)}">点击下载</a></audio>`;
      }
    } else {
      preview.innerHTML =
        '<p style="color:var(--text-secondary)">暂不支持预览此文件类型</p>';
    }

    const drawer = document.getElementById("drawer");
    drawer.style.display = "flex";
    document.body.style.overflow = "hidden";
    this.currentDrawerId = id;
    this.focusTrap(drawer);
    lucide.createIcons();
  },

  closeDrawer() {
    const drawer = document.getElementById("drawer");
    const panel = document.getElementById("drawerPanel");
    if (panel) {
      panel.style.animation =
        "slideOutRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards";
      panel.addEventListener(
        "animationend",
        () => {
          drawer.style.display = "none";
          panel.style.animation = "";
        },
        { once: true },
      );
    } else {
      drawer.style.display = "none";
    }
    document.body.style.overflow = "";
  },

  focusTrap(container) {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();
    container.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  },

  drawerToggleFav() {
    if (this.currentDrawerId) {
      this.toggleFavorite(this.currentDrawerId);
      this.openDrawer(this.currentDrawerId);
    }
  },

  drawerEdit() {
    if (this.currentDrawerId) {
      const entry = this.data.entries.find(
        (e) => e.id === this.currentDrawerId,
      );
      if (entry) {
        this.closeDrawer();
        setTimeout(() => this.openForm(entry), 300);
      }
    }
  },

  drawerDownload() {
    if (!this.currentDrawerId) return;
    const entry = this.data.entries.find((e) => e.id === this.currentDrawerId);
    if (!entry || !entry.path) {
      Toast.warning("无文件可下载");
      return;
    }
    const basePath = window.location.pathname.replace(/\/[^\/]*$/, "/");
    const a = document.createElement("a");
    a.href = basePath + entry.path;
    a.download = entry.path.split("/").pop();
    a.click();
    Toast.success("下载已开始");
  },

  drawerDelete() {
    if (!this.currentDrawerId) return;
    const entry = this.data.entries.find((e) => e.id === this.currentDrawerId);
    if (!entry) return;
    ConfirmDialog.show(`确定要删除「${entry.title}」吗？`).then((confirmed) => {
      if (!confirmed) return;
      this.data.entries = this.data.entries.filter(
        (e) => e.id !== this.currentDrawerId,
      );
      this.rebuildMetadata();
      this.setupSearch();
      this.saveData();
      this.renderSidebar();
      this.renderCards();
      this.updateStats();
      this.renderActiveFilters();
      this.closeDrawer();
      if (document.getElementById("adminPanel").style.display !== "none")
        ADMIN.renderTable();
      Toast.success("删除成功");
    });
  },

  openForm(entry = null) {
    const modal = document.getElementById("formModal");
    const titleEl = document.getElementById("formTitleText");
    const select = document.getElementById("formCategory");

    select.innerHTML = '<option value="">请选择分类</option>';
    [...this.categories].sort().forEach((c) => {
      select.innerHTML += `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`;
    });

    if (entry) {
      titleEl.textContent = "编辑文件";
      document.getElementById("editId").value = entry.id;
      document.getElementById("formTitle").value = entry.title;
      select.value = entry.category;
      document.getElementById("formTags").value = entry.tags.join(", ");
      document.getElementById("formPath").value = entry.path || "";
      document.getElementById("formDesc").value = entry.description || "";
      document.getElementById("formCategoryNew").value = "";
    } else {
      titleEl.textContent = "添加文件";
      document.getElementById("editId").value = "";
      document.getElementById("formTitle").value = "";
      select.value = "";
      document.getElementById("formTags").value = "";
      document.getElementById("formPath").value = "";
      document.getElementById("formDesc").value = "";
      document.getElementById("formCategoryNew").value = "";
    }
    this.populatePathSuggestions();
    modal.style.display = "flex";
  },

  closeForm() {
    document.getElementById("formModal").style.display = "none";
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById("editId").value;
    const titleInput = document.getElementById("formTitle");
    const categorySelect = document.getElementById("formCategory");
    const categoryNew = document.getElementById("formCategoryNew");
    const tagsInput = document.getElementById("formTags");
    const pathInput = document.getElementById("formPath");
    const descInput = document.getElementById("formDesc");

    const category = categoryNew.value.trim() || categorySelect.value;
    if (!category) {
      Toast.warning("请选择或输入分类");
      return;
    }

    const tags = tagsInput.value
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const path = pathInput.value.trim();
    const description = descInput.value.trim();

    if (editId) {
      const entry = this.data.entries.find((en) => en.id === parseInt(editId));
      if (entry) {
        const oldCat = entry.category;
        entry.title = titleInput.value.trim();
        entry.category = category;
        entry.tags = tags;
        entry.path = path;
        entry.description = description;
        if (oldCat !== category) {
          this.categories.delete(oldCat);
        }
        this.categories.add(category);
        tags.forEach((t) => this.tags.add(t));
      }
    } else {
      this.data.entries.push({
        id: this.nextId++,
        title: titleInput.value.trim(),
        category,
        tags,
        path,
        description,
        createdAt: new Date().toISOString().slice(0, 10),
        type: FileType.detect(path),
      });
      this.categories.add(category);
      tags.forEach((t) => this.tags.add(t));
    }

    this.setupSearch();
    this.saveData();
    this.renderSidebar();
    this.renderCards();
    this.updateStats();
    this.renderActiveFilters();
    this.closeForm();
    Toast.success(editId ? "更新成功" : "添加成功");

    const adminPanel = document.getElementById("adminPanel");
    if (adminPanel && adminPanel.style.display !== "none") ADMIN.renderTable();
  },

  saveData() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  },

  updateStats() {
    const total = this.data.entries.length;
    const filtered = this.getFilteredEntries().length;
    const sidebarStats = document.getElementById("sidebarStats");
    const footerStats = document.getElementById("footerStats");
    if (sidebarStats)
      sidebarStats.textContent = `共 ${total} 条 · 显示 ${filtered} 条`;
    if (footerStats) footerStats.textContent = `共 ${total} 条记录`;
  },

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  },

  loadUrlState() {
    const params = new URLSearchParams(window.location.search);
    this.searchQuery = params.get("q") || "";
    this.activeCategory = params.get("cat") || null;
    this.activeTag = params.get("tag") || null;
    this.showFavoritesOnly = params.get("fav") === "1";
    if (this.searchQuery)
      document.getElementById("searchInput").value = this.searchQuery;
  },

  updateUrlState() {
    const params = new URLSearchParams();
    if (this.searchQuery) params.set("q", this.searchQuery);
    if (this.activeCategory) params.set("cat", this.activeCategory);
    if (this.activeTag) params.set("tag", this.activeTag);
    if (this.showFavoritesOnly) params.set("fav", "1");
    const url = params.toString()
      ? "?" + params.toString()
      : window.location.pathname;
    window.history.replaceState(
      {
        q: this.searchQuery,
        cat: this.activeCategory,
        tag: this.activeTag,
        fav: !!this.showFavoritesOnly,
      },
      "",
      url,
    );
  },

  setupOfflineDetection() {
    window.addEventListener("online", () => {
      document.body.classList.remove("offline");
      Toast.success("网络已恢复");
    });
    window.addEventListener("offline", () => {
      document.body.classList.add("offline");
      Toast.warning("网络已断开，部分功能可能受限");
    });
    if (!navigator.onLine) document.body.classList.add("offline");
  },

  loadFavorites() {
    try {
      const saved = localStorage.getItem("kb_favorites");
      if (saved) this.favorites = new Set(JSON.parse(saved));
    } catch (e) {}
  },

  toggleFavorite(id) {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
    } else {
      this.favorites.add(id);
    }
    localStorage.setItem("kb_favorites", JSON.stringify([...this.favorites]));
    this.renderCards();
    this.renderSidebar();
  },

  isFavorite(id) {
    return this.favorites.has(id);
  },

  toggleBatchSelect(id, checked) {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
    const countEl = document.getElementById("batchCount");
    if (countEl) countEl.textContent = `已选 ${this.selectedIds.size} 项`;
  },

  toggleSelectAll(selectAllChecked) {
    const checkboxes = document.querySelectorAll(".entry-card .batch-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = selectAllChecked;
      const id = parseInt(cb.dataset.id);
      if (selectAllChecked) {
        this.selectedIds.add(id);
      } else {
        this.selectedIds.delete(id);
      }
    });
    const countEl = document.getElementById("batchCount");
    if (countEl) countEl.textContent = `已选 ${this.selectedIds.size} 项`;
  },

  batchDelete() {
    if (this.selectedIds.size === 0) {
      Toast.warning("请选择要删除的条目");
      return;
    }
    ConfirmDialog.show(
      `确定删除选中的 ${this.selectedIds.size} 个条目吗？`,
    ).then((confirmed) => {
      if (!confirmed) return;
      this.data.entries = this.data.entries.filter(
        (e) => !this.selectedIds.has(e.id),
      );
      this.selectedIds.clear();
      this.batchMode = false;
      document.getElementById("batchToolbar").style.display = "none";
      this.rebuildMetadata();
      this.setupSearch();
      this.saveData();
      this.renderSidebar();
      this.renderCards();
      this.updateStats();
      this.renderActiveFilters();
      if (document.getElementById("adminPanel").style.display !== "none")
        ADMIN.renderTable();
      Toast.success("删除成功");
    });
  },

  batchMoveCategory() {
    if (this.selectedIds.size === 0) {
      Toast.warning("请选择要移动的条目");
      return;
    }
    const cat = prompt("请输入目标分类名称：");
    if (!cat) return;
    this.data.entries.forEach((e) => {
      if (this.selectedIds.has(e.id)) e.category = cat;
    });
    this.selectedIds.clear();
    this.batchMode = false;
    document.getElementById("batchToolbar").style.display = "none";
    this.rebuildMetadata();
    this.setupSearch();
    this.saveData();
    this.renderSidebar();
    this.renderCards();
    this.updateStats();
    this.renderActiveFilters();
    if (document.getElementById("adminPanel").style.display !== "none")
      ADMIN.renderTable();
    Toast.success("移动成功");
  },

  initTheme() {
    const saved = localStorage.getItem("kb_theme");
    if (
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.setAttribute("data-theme", "dark");
      this.updateThemeIcon(true);
    }
  },

  toggleTheme() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "light" : "dark",
    );
    localStorage.setItem("kb_theme", isDark ? "light" : "dark");
    this.updateThemeIcon(!isDark);
  },

  updateThemeIcon(isDark) {
    const icon = document.getElementById("themeIcon");
    if (icon) {
      icon.setAttribute("data-lucide", isDark ? "moon" : "sun");
      lucide.createIcons();
    }
  },

  populatePathSuggestions() {
    const datalist = document.getElementById("pathSuggestions");
    if (!datalist) return;
    const paths = this.data.entries.map((e) => e.path).filter(Boolean);
    datalist.innerHTML = [...new Set(paths)]
      .map((p) => `<option value="${this.escapeHtml(p)}">`)
      .join("");
  },
};

document.addEventListener("DOMContentLoaded", () => APP.init());
