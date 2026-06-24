﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿const APP = {
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
  pageSize: 50,
  favorites: new Set(),
  showFavoritesOnly: false,
  selectedIds: new Set(),
  serverUpdate: null,
  density: localStorage.getItem("kb_density") || "normal",
  selectedEntryId: null,
  focusedEntryId: null,
  currentReaderId: null,
  currentSidebarView: "all",
  _filteredEntries: null,
  _cmdFilterTimer: null,
  cmdHighlight: -1,
  apiMode: false,
  batchMode: false,
  listView: localStorage.getItem("kb_list_view") || "list",
  metadataType: "tag",

  async init() {
    this.registerSW();
    this.detectFileProtocol();
    const list = document.getElementById("entryList");
    if (list) Skeleton.show(list, this.listView);
    this.apiMode = await API.check();
    if (this.apiMode) {
      console.log("API 模式已启用：数据通过本地后端服务持久化");
      localStorage.removeItem("kb_localOverrides");
    }
    await this.loadData();
    this.loadUrlState();
    this.setupOfflineDetection();
    this.loadFavorites();
    this.setupSearch();
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.applyDensity();
    this.renderSidebar();
    this.renderList();
    this.renderDetail();
    this.updateStatus();
    this.renderFilterChips();
    this.initTheme();
    UI.init(this);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  async loadData() {
    if (this.apiMode) {
      try {
        this.data = await API.listEntries();
        if (!this.data.deletedEntries) this.data.deletedEntries = [];
        this.rebuildMetadata();
        this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
        this.saveData();
        console.log("Loaded from API:", this.data.entries.length, "entries");
        return;
      } catch (err) {
        console.error("API load failed, falling back:", err);
        this.apiMode = false;
        API.reset();
      }
    }

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.data = JSON.parse(stored);
        if (!this.data.deletedEntries) this.data.deletedEntries = [];
        this.rebuildMetadata();
        this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
        this.checkServerUpdate();
        return;
      } catch (e) {
        console.warn("localStorage corrupted");
      }
    }
    try {
      const resp = await fetch("data/index.json?v=" + Date.now());
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      this.data = await resp.json();
      if (!this.data.deletedEntries) this.data.deletedEntries = [];
      this.rebuildMetadata();
      this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
      this.saveData();
    } catch (err) {
      console.error("Failed to load data:", err);
      this.data = { version: "1.0.0", siteTitle: "知识库", entries: [], deletedEntries: [] };
      this.rebuildMetadata();
    }
  },

  rebuildMetadata() {
    this.categories.clear();
    this.tags.clear();
    this.data.entries.forEach((e) => {
      this.categories.add(e.category);
      e.tags.forEach((t) => this.tags.add(t));
    });
  },

  setupSearch() {
    if (typeof MiniSearch === "undefined") return;
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
        const ch = text.match(/[\u4e00-\u9fff]/g);
        if (ch && ch.length > 1) {
          for (let i = 0; i < ch.length - 1; i++)
            tokens.push(ch[i] + ch[i + 1]);
        }
        return tokens.filter(Boolean);
      },
      searchOptions: {
        boost: { title: 3, description: 2, tags: 1.5, category: 1 },
      },
    });
    this.data.entries.forEach((e) => {
      this.addToSearchIndex(e);
    });
  },

  addToSearchIndex(entry) {
    if (!this.searchIndex || !entry) return;
    try {
      this.searchIndex.add({
        id: entry.id,
        title: entry.title,
        description: entry.description || "",
        tags: entry.tags.join(" "),
        category: entry.category,
      });
    } catch (err) {
      // MiniSearch 可能已存在该 id，忽略或重新添加
      console.warn("addToSearchIndex failed:", err);
    }
  },

  updateSearchIndex(entry) {
    if (!this.searchIndex || !entry) return;
    try {
      this.searchIndex.discard(entry.id);
    } catch {}
    this.addToSearchIndex(entry);
  },

  removeFromSearchIndex(id) {
    if (!this.searchIndex) return;
    try {
      this.searchIndex.discard(id);
    } catch {}
  },

  invalidateFilteredEntries() {
    this._filteredEntries = null;
  },

  getFilteredEntries() {
    if (this._filteredEntries) return this._filteredEntries;

    if (this.currentSidebarView === "recyclebin") {
      let entries = [...(this.data.deletedEntries || [])];
      if (this.sortField === "createdAt")
        entries = Sorter.sortByDate(entries, this.sortDirection === "asc");
      else if (this.sortField === "title")
        entries = Sorter.sortByTitle(entries, this.sortDirection === "asc");
      this._filteredEntries = entries;
      return entries;
    }
    let entries = [...this.data.entries];
    if (this.showFavoritesOnly)
      entries = entries.filter((e) => this.favorites.has(e.id));
    if (this.activeCategory)
      entries = entries.filter((e) => e.category === this.activeCategory);
    if (this.activeTag)
      entries = entries.filter((e) => e.tags.includes(this.activeTag));
    if (this.searchQuery && this.searchIndex) {
      const ids = new Set(
        this.searchIndex.search(this.searchQuery).map((r) => r.id),
      );
      entries = entries.filter((e) => ids.has(e.id));
    } else if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (this.sortField === "createdAt")
      entries = Sorter.sortByDate(entries, this.sortDirection === "asc");
    else if (this.sortField === "title")
      entries = Sorter.sortByTitle(entries, this.sortDirection === "asc");
    this._filteredEntries = entries;
    return entries;
  },

  // ─── Rendering ───

  renderList() {
    this.invalidateFilteredEntries();
    const list = document.getElementById("entryList");
    const empty = document.getElementById("emptyState");
    const entries = this.getFilteredEntries();

    if (entries.length === 0) {
      list.innerHTML = "";
      if (empty) {
        empty.style.display = "flex";
        empty.innerHTML = this.getEmptyState();
      }
    } else {
      if (empty) empty.style.display = "none";
      list.className =
        "entry-list" + (this.listView === "grid" ? " grid-view" : "");
      list.innerHTML = entries.map((e) => this.renderEntryRow(e)).join("");
      list.querySelectorAll('.entry-checkbox input[type="checkbox"]').forEach((cb) => {
        cb.checked = this.selectedIds.has(parseInt(cb.dataset.id));
      });
      if (this.focusedEntryId) {
        const focusedRow = list.querySelector(`.entry-row[data-id="${this.focusedEntryId}"]`);
        if (focusedRow) focusedRow.classList.add("focused");
      }
    }
    this.updateStatus();
    this.updateListTitle();
    this.updateSidebarCounts();
    this.updateUrlState();
    if (typeof lucide !== "undefined") lucide.createIcons();
    Skeleton.hide(list);
  },

  getEmptyState() {
    const configs = {
      recyclebin: {
        icon: "trash-2",
        title: "回收站为空",
        hint: "删除的条目会出现在这里，30 天后自动清理。",
        action: null,
      },
      favorites: {
        icon: "star",
        title: "暂无收藏",
        hint: "点击条目右侧的星标，将常用文件加入收藏。",
        action: null,
      },
      recent: {
        icon: "clock",
        title: "最近阅读为空",
        hint: "打开任意条目后，最近阅读列表会显示在这里。",
        action: null,
      },
      uncategorized: {
        icon: "folder-x",
        title: "所有条目已分类",
        hint: "当前没有未分类的条目。",
        action: null,
      },
    };

    let cfg = configs[this.currentSidebarView] || {
      icon: "file-x",
      title: "暂无条目",
      hint: "点击左上角「添加文件」开始构建知识库。",
      action: `<button class="btn btn-primary" onclick="APP.openForm()"><i data-lucide="plus"></i> 添加文件</button>`,
    };

    if (this.searchQuery) {
      cfg = {
        icon: "search-x",
        title: "未找到匹配结果",
        hint: `没有与 "${this.escapeHtml(this.searchQuery)}" 匹配的条目，试试其他关键词。`,
        action: `<button class="btn btn-secondary" onclick="APP.clearSearch()"><i data-lucide="x"></i> 清除搜索</button>`,
      };
    } else if (this.activeCategory) {
      cfg = {
        icon: "folder-open",
        title: this.escapeHtml(this.activeCategory),
        hint: "该分类下暂时没有条目。",
        action: `<button class="btn btn-secondary" onclick="APP.activeCategory=null;APP.renderSidebar();APP.renderList();APP.renderFilterChips();"><i data-lucide="arrow-left"></i> 查看全部</button>`,
      };
    } else if (this.activeTag) {
      cfg = {
        icon: "hash",
        title: "#" + this.escapeHtml(this.activeTag),
        hint: "该标签下暂时没有条目。",
        action: `<button class="btn btn-secondary" onclick="APP.activeTag=null;APP.renderSidebar();APP.renderList();APP.renderFilterChips();"><i data-lucide="arrow-left"></i> 查看全部</button>`,
      };
    }

    const actionHtml = cfg.action ? `<div class="empty-state-action">${cfg.action}</div>` : "";
    return `
      <div class="empty-state-icon"><i data-lucide="${cfg.icon}"></i></div>
      <p>${cfg.title}</p>
      <span>${cfg.hint}</span>
      ${actionHtml}
    `;
  },

  clearSearch() {
    this.searchQuery = "";
    this.renderList();
    this.renderFilterChips();
    this.updateStatus();
  },

  selectEntry(id) {
    this.selectedEntryId = id;
    this.focusedEntryId = id;
    UI.addRecentId(id);
    this.renderList();
    this.renderDetail();
    UI.openDetailPanel();
    if (window.innerWidth <= 768) UI.showMobileTab("detail");
  },

  renderEntryRow(entry) {
    const isFav = this.favorites.has(entry.id);
    const isSelected = this.selectedEntryId === entry.id;
    const isBatchSelected = this.selectedIds.has(entry.id);
    const isRecycle = this.currentSidebarView === "recyclebin";
    const icon = this.getLucideIcon(FileType.detect(entry.path));
    const cat = this.escapeHtml(entry.category);
    const date = entry.createdAt || "";
    const deletedAt = entry.deletedAt || "";
    const title = this.highlightText(entry.title);
    const desc = this.highlightText(entry.description || "");
    const tags = entry.tags
      .map((t) => `<span class="entry-tag">#${this.highlightText(t)}</span>`)
      .join("");
    const checkbox = `<label class="entry-checkbox" onclick="event.stopPropagation()"><input type="checkbox" data-id="${entry.id}"></label>`;
    const favIcon = isFav
      ? `<i data-lucide="star" style="fill:var(--accent-amber);color:var(--accent-amber);"></i>`
      : `<i data-lucide="star"></i>`;
    const actionBtn = isRecycle
      ? `<button class="entry-action-btn" data-action="restore" data-id="${entry.id}" title="恢复"><i data-lucide="rotate-ccw"></i></button><button class="entry-action-btn entry-action-danger" data-action="permanent-delete" data-id="${entry.id}" title="永久删除"><i data-lucide="trash-2"></i></button>`
      : `<button class="entry-fav ${isFav ? "favorited" : ""}" data-action="favorite" data-id="${entry.id}">${favIcon}</button>`;

    let cls = `entry-row density-${this.density}`;
    if (isSelected) cls += " active";
    if (isBatchSelected) cls += " batch-selected";
    if (isRecycle) cls += " recycle-row";

    const metaDate = isRecycle
      ? `<span class="entry-deleted-at" title="删除时间">${deletedAt.slice(0, 10)}</span>`
      : `<span class="entry-date">${date}</span>`;

    if (this.density === "compact") {
      return `<div class="${cls}" data-id="${entry.id}" role="listitem">
        ${checkbox}
        <i data-lucide="${icon}" class="entry-icon"></i>
        <div class="entry-main">
          <div class="entry-top">
            <span class="entry-title">${title}</span>
            <span class="entry-category">${cat}</span>
          </div>
        </div>
        <span class="entry-meta" style="margin-right:8px;">${metaDate}</span>
        <div class="entry-actions">${actionBtn}</div>
      </div>`;
    }
    if (this.density === "cozy") {
      return `<div class="${cls}" data-id="${entry.id}" role="listitem">
        ${checkbox}
        <i data-lucide="${icon}" class="entry-icon"></i>
        <div class="entry-main">
          <div class="entry-top">
            <span class="entry-title">${title}</span>
            <span class="entry-category">${cat}</span>
          </div>
          <div class="entry-desc">${desc || "暂无描述"}</div>
          <div class="entry-bottom">
            <div class="entry-tags">${tags}</div>
            ${metaDate}
          </div>
        </div>
        <div class="entry-actions">${actionBtn}</div>
      </div>`;
    }
    // default: normal
    return `<div class="${cls}" data-id="${entry.id}" role="listitem">
      ${checkbox}
      <i data-lucide="${icon}" class="entry-icon"></i>
      <div class="entry-main">
        <div class="entry-top">
          <span class="entry-title">${title}</span>
          <span class="entry-category">${cat}</span>
        </div>
        <div class="entry-bottom">
          <div class="entry-tags">${tags}</div>
          ${metaDate}
        </div>
      </div>
      <div class="entry-actions">${actionBtn}</div>
    </div>`;
  },

  renderDetail() {
    const empty = document.getElementById("detailEmpty");
    const content = document.getElementById("detailContent");
    if (!empty || !content) return;
    if (!this.selectedEntryId) {
      empty.style.display = "flex";
      content.style.display = "none";
      return;
    }
    const entry = this.data.entries.find((e) => e.id === this.selectedEntryId);
    if (!entry) {
      this.selectedEntryId = null;
      empty.style.display = "flex";
      content.style.display = "none";
      return;
    }
    empty.style.display = "none";
    content.style.display = "flex";

    const isFav = this.isFavorite(entry.id);
    document.getElementById("detailCategory").textContent = entry.category;
    document.getElementById("detailTags").innerHTML = entry.tags
      .map((t) => `<span class="detail-tag">#${this.escapeHtml(t)}</span>`)
      .join(" ");
    document.getElementById("detailDate").textContent = entry.createdAt || "-";
    document.getElementById("detailTitle").textContent = entry.title;
    const detailDesc = document.getElementById("detailDesc");
    if (detailDesc) {
      detailDesc.innerHTML =
        entry.description && typeof marked !== "undefined"
          ? marked.parse(entry.description)
          : this.escapeHtml(entry.description || "暂无描述");
    }

    const favBtn = document.getElementById("detailFavBtn");
    if (favBtn) {
      favBtn.innerHTML = isFav
        ? '<i data-lucide="star" style="fill:var(--accent-amber);color:var(--accent-amber);"></i> 已收藏'
        : '<i data-lucide="star"></i> 收藏';
      favBtn.classList.toggle("favorited", isFav);
      favBtn.onclick = () => this.toggleFavorite(entry.id);
    }

    const preview = document.getElementById("detailPreview");
    preview.innerHTML =
      '<div class="loading-spinner"><div class="spinner"></div><p>加载预览...</p></div>';
    this.loadPreviewInto(entry, preview);

    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  loadPreviewInto(entry, el) {
    if (!entry || !el) return;
    const ft = FileType.detect(entry.path);
    if (!entry.path || !FileType.isPreviewable(ft)) {
      el.innerHTML =
        '<p style="color:var(--text-tertiary);font-size:13px;">暂不支持预览此文件类型</p>';
      return;
    }
    const base = window.location.pathname.replace(/\/[^\/]*$/, "/");
    const full = base + entry.path;
    if (ft === "markdown") {
      fetch(full, { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw Error();
          return r.text();
        })
        .then((t) => {
          el.innerHTML =
            typeof marked !== "undefined"
              ? marked.parse(t)
              : "<pre>" + this.escapeHtml(t) + "</pre>";
        })
        .catch(() => {
          const isFileProtocol = window.location.protocol === "file:";
          el.innerHTML =
            '<p style="color:var(--text-tertiary);font-size:13px;">' +
            (isFileProtocol
              ? 'file:// 协议无法加载文件，请通过本地服务器访问'
              : '文件不存在或无法加载') +
            '</p>';
        });
    } else if (ft === "image") {
      el.innerHTML =
        '<img src="' +
        this.escapeHtml(full) +
        '" style="max-width:100%;border-radius:var(--radius-md);">';
    } else if (ft === "pdf") {
      el.innerHTML =
        '<iframe src="' +
        this.escapeHtml(full) +
        '" style="width:100%;height:500px;border:none;border-radius:var(--radius-md);"></iframe>';
    } else if (ft === "video") {
      el.innerHTML =
        '<video controls style="max-width:100%;border-radius:var(--radius-md);"><source src="' +
        this.escapeHtml(full) +
        '"></video>';
    } else if (ft === "audio") {
      el.innerHTML =
        '<audio controls style="width:100%;"><source src="' +
        this.escapeHtml(full) +
        '"></audio>';
    } else {
      el.innerHTML =
        '<p style="color:var(--text-tertiary);font-size:13px;">暂不支持预览此文件类型</p>';
    }
  },

  // ─── Sidebar & Counts ───

  renderSidebar() {
    const categoryTree = document.getElementById("categoryTree");
    const sidebarTags = document.getElementById("sidebarTags");
    if (categoryTree) {
      const cats = [...this.categories].sort();
      categoryTree.innerHTML = cats
        .map(
          (c) =>
            `<div class="tree-item ${this.activeCategory === c ? "active" : ""}" data-cat="${this.escapeHtml(c)}">
              <i data-lucide="folder"></i>
              <span>${this.escapeHtml(c)}</span>
            </div>`,
        )
        .join("");
    }
    if (sidebarTags) {
      const tags = [...this.tags].sort().slice(0, 20);
      sidebarTags.innerHTML = tags
        .map(
          (t) =>
            `<span class="tag-pill ${this.activeTag === t ? "active" : ""}" data-tag="${this.escapeHtml(t)}">#${this.escapeHtml(t)}</span>`,
        )
        .join("");

    }

    document.querySelectorAll(".sidebar-item[data-view]").forEach((el) => {
      el.classList.toggle("active", el.dataset.view === this.currentSidebarView);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  updateSidebarCounts() {
    const total = this.data.entries.length;
    const recentIds = UI.getRecentIds();
    const recentCount = this.data.entries.filter((e) => recentIds.includes(e.id)).length;
    const favCount = this.favorites.size;
    const uncategorizedCount = this.data.entries.filter(
      (e) => !e.category || e.category === "未分类",
    ).length;
    const recycleCount = (this.data.deletedEntries || []).length;

    const setCount = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };
    setCount("countAll", total);
    setCount("countRecent", recentCount);
    setCount("countFavorites", favCount);
    setCount("countUncategorized", uncategorizedCount);
    setCount("countRecycleBin", recycleCount);

    const storageCount = document.getElementById("storageCount");
    if (storageCount) storageCount.textContent = `${total} 条目`;
    const storageFill = document.getElementById("storageFill");
    if (storageFill) {
      const max = Math.max(total, 100);
      storageFill.style.width = `${Math.min((total / max) * 100, 100)}%`;
    }
  },

  updateListTitle() {
    const title = document.getElementById("listTitle");
    if (!title) return;
    const viewMap = {
      all: "全部条目",
      recent: "最近阅读",
      favorites: "我的收藏",
      uncategorized: "未分类",
      recyclebin: "回收站",
    };
    if (this.activeCategory) {
      title.textContent = this.activeCategory;
    } else if (this.activeTag) {
      title.textContent = "#" + this.activeTag;
    } else if (this.showFavoritesOnly) {
      title.textContent = viewMap.favorites;
    } else {
      title.textContent = viewMap[this.currentSidebarView] || "全部条目";
    }
  },

  // ─── Batch Operations ───

  toggleSelection(id) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);

    const row = document.querySelector(`.entry-row[data-id="${id}"]`);
    if (row) {
      row.classList.toggle("batch-selected", this.selectedIds.has(id));
      const cb = row.querySelector('.entry-checkbox input[type="checkbox"]');
      if (cb) cb.checked = this.selectedIds.has(id);
    }

    this.updateBatchBar();
  },

  setBatchMode(enabled, { skipRender = false } = {}) {
    this.batchMode = enabled;
    this.selectedIds.clear();
    document.body.classList.toggle("batch-mode", enabled);
    const bar = document.getElementById("batchBar");
    if (bar) bar.style.display = enabled ? "flex" : "none";
    this.updateBatchBar();
    if (!skipRender) this.renderList();
  },

  updateBatchBar() {
    const count = document.getElementById("batchCount");
    if (count) count.textContent = `已选择 ${this.selectedIds.size} 项`;
    const isRecycle = this.currentSidebarView === "recyclebin";
    const setDisplay = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.style.display = val;
    };
    setDisplay("batchMoveBtn", isRecycle ? "none" : "inline-flex");
    setDisplay("batchTagBtn", isRecycle ? "none" : "inline-flex");
    setDisplay("batchFavBtn", isRecycle ? "none" : "inline-flex");
    setDisplay("batchRestoreBtn", isRecycle ? "inline-flex" : "none");
    const delBtn = document.getElementById("batchDeleteBtn");
    if (delBtn)
      delBtn.innerHTML = isRecycle
        ? '<i data-lucide="trash-2"></i> 永久删除'
        : '<i data-lucide="trash-2"></i> 删除';
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  async batchDelete() {
    if (this.selectedIds.size === 0) return;
    const isRecycle = this.currentSidebarView === "recyclebin";
    const batchCount = this.selectedIds.size;
    const ok = await ConfirmDialog.show(
      isRecycle
        ? `确定永久删除选中的 ${batchCount} 项吗？此操作不可撤销。`
        : `确定删除选中的 ${batchCount} 项吗？删除后可从回收站恢复。`,
    );
    if (!ok) return;
    if (isRecycle) {
      this.data.deletedEntries = (this.data.deletedEntries || []).filter(
        (e) => !this.selectedIds.has(e.id),
      );
    } else {
      for (const id of [...this.selectedIds]) {
        const entry = this.data.entries.find((e) => e.id === id);
        if (!entry) continue;
        if (this.apiMode) {
          try {
            await API.deleteEntry(id);
          } catch (err) {
            console.error("API delete failed:", err);
          }
        }
        this.data.entries = this.data.entries.filter((e) => e.id !== id);
        entry.deletedAt = new Date().toISOString();
        if (!this.data.deletedEntries) this.data.deletedEntries = [];
        this.data.deletedEntries.push(entry);
      }
    }
    this.setBatchMode(false, { skipRender: true });
    this.refreshAfterDataChange({
      message: isRecycle ? "已永久删除" : "已移至回收站",
    });
    History.log(isRecycle ? "批量永久删除" : "批量删除", `${batchCount} 项`);
  },

  async batchRestore() {
    if (this.selectedIds.size === 0) return;
    const batchCount = this.selectedIds.size;
    for (const id of [...this.selectedIds]) {
      const idx = (this.data.deletedEntries || []).findIndex((e) => e.id === id);
      if (idx === -1) continue;
      const entry = this.data.deletedEntries[idx];
      const existingId = this.data.entries.find((e) => e.id === id);
      if (existingId) entry.id = this.nextId++;
      delete entry.deletedAt;
      if (this.apiMode) {
        try {
          const created = await API.createEntry(entry);
          this.data.entries.push(created);
          this.data.deletedEntries.splice(idx, 1);
        } catch (err) {
          console.error("API restore failed:", err);
        }
      } else {
        this.data.entries.push(entry);
        this.data.deletedEntries.splice(idx, 1);
      }
    }
    this.setBatchMode(false, { skipRender: true });
    this.refreshAfterDataChange({ message: "批量恢复成功" });
    History.log("批量恢复", `${batchCount} 项`);
  },

  async batchMove() {
    if (this.selectedIds.size === 0) return;
    const batchCount = this.selectedIds.size;
    const cats = [...this.categories].sort();
    const cat = await PromptDialog.show(
      "移动到分类",
      "请选择或输入新分类",
      cats,
    );
    if (!cat) return;
    for (const id of [...this.selectedIds]) {
      const entry = this.data.entries.find((e) => e.id === id);
      if (!entry) continue;
      entry.category = cat;
      if (this.apiMode) {
        try {
          await API.updateEntry(id, entry);
        } catch (err) {
          console.error("API update failed:", err);
        }
      }
    }
    this.setBatchMode(false, { skipRender: true });
    this.refreshAfterDataChange({ message: "批量移动成功" });
    History.log("批量移动", `${batchCount} 项 → ${cat}`);
  },

  async batchTag() {
    if (this.selectedIds.size === 0) return;
    const batchCount = this.selectedIds.size;
    const tag = await PromptDialog.show(
      "添加标签",
      "请输入要添加的标签（多个用逗号分隔）",
    );
    if (!tag) return;
    const newTags = tag.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    for (const id of [...this.selectedIds]) {
      const entry = this.data.entries.find((e) => e.id === id);
      if (!entry) continue;
      const set = new Set([...(entry.tags || []), ...newTags]);
      entry.tags = [...set];
      if (this.apiMode) {
        try {
          await API.updateEntry(id, entry);
        } catch (err) {
          console.error("API update failed:", err);
        }
      }
    }
    this.setBatchMode(false, { skipRender: true });
    this.refreshAfterDataChange({ message: "批量加标签成功" });
    History.log("批量加标签", `${batchCount} 项 → ${newTags.join(", ")}`);
  },

  async batchFavorite() {
    if (this.selectedIds.size === 0) return;
    const batchCount = this.selectedIds.size;
    const allFav = [...this.selectedIds].every((id) => this.favorites.has(id));
    for (const id of [...this.selectedIds]) {
      if (allFav) this.favorites.delete(id);
      else this.favorites.add(id);
    }
    localStorage.setItem("kb_favorites", JSON.stringify([...this.favorites]));
    this.selectedIds.clear();
    this.setBatchMode(false);
    this.renderList();
    this.renderDetail();
    this.updateSidebarCounts();
    Toast.success(allFav ? "已取消收藏" : "已批量收藏");
    History.log(allFav ? "批量取消收藏" : "批量收藏", `${batchCount} 项`);
  },

  // ─── Metadata Manager ───

  openMetadataManager(type) {
    this.metadataType = type;
    document.getElementById("metadataTitle").textContent =
      type === "tag" ? "标签管理" : "分类管理";
    document.getElementById("metadataModal").style.display = "flex";
    this.renderMetadataList();
  },

  closeMetadataManager() {
    document.getElementById("metadataModal").style.display = "none";
  },

  renderMetadataList() {
    const list = document.getElementById("metadataList");
    const toolbar = document.getElementById("metadataToolbar");
    const isTag = this.metadataType === "tag";
    toolbar.innerHTML = isTag
      ? `<button class="btn btn-secondary btn-sm" id="cleanUnusedTagsBtn"><i data-lucide="broom"></i> 清理未使用标签</button>`
      : "";

    const items = isTag
      ? [...this.tags].sort()
      : [...this.categories].sort();
    if (items.length === 0) {
      list.innerHTML = `<div class="metadata-empty">暂无${isTag ? "标签" : "分类"}</div>`;
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }

    list.innerHTML = items
      .map((item) => {
        const count = isTag
          ? this.data.entries.filter((e) => e.tags.includes(item)).length
          : this.data.entries.filter((e) => e.category === item).length;
        return `
        <div class="metadata-item" data-name="${this.escapeHtml(item)}">
          <div class="metadata-info">
            <span class="metadata-name">${this.escapeHtml(item)}</span>
            <span class="metadata-count">${count} 条</span>
          </div>
          <div class="metadata-actions">
            <button class="btn btn-ghost btn-sm" data-action="rename">重命名</button>
            <button class="btn btn-ghost btn-sm" data-action="merge">合并</button>
            <button class="btn btn-danger btn-sm" data-action="delete">删除</button>
          </div>
        </div>`;
      })
      .join("");

    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  async renameMetadata(name) {
    const isTag = this.metadataType === "tag";
    const newName = await PromptDialog.show(
      `重命名${isTag ? "标签" : "分类"}`,
      `将 "${name}" 重命名为：`,
    );
    if (!newName || newName === name) return;
    let changed = 0;
    this.data.entries.forEach((e) => {
      if (isTag) {
        const idx = e.tags.indexOf(name);
        if (idx !== -1) {
          e.tags[idx] = newName;
          changed++;
        }
      } else if (e.category === name) {
        e.category = newName;
        changed++;
      }
    });
    if (changed === 0) return;
    await this.persistMetadataChanges(
      `${isTag ? "标签" : "分类"}重命名成功`,
    );
  },

  async mergeMetadata(name) {
    const isTag = this.metadataType === "tag";
    const candidates = isTag
      ? [...this.tags].filter((t) => t !== name).sort()
      : [...this.categories].filter((c) => c !== name).sort();
    if (candidates.length === 0) {
      Toast.warning("没有其他可合并目标");
      return;
    }
    const target = await PromptDialog.show(
      `合并${isTag ? "标签" : "分类"}`,
      `将 "${name}" 合并到：`,
      candidates,
    );
    if (!target || target === name) return;
    this.data.entries.forEach((e) => {
      if (isTag) {
        if (e.tags.includes(name)) {
          e.tags = e.tags.filter((t) => t !== name);
          if (!e.tags.includes(target)) e.tags.push(target);
        }
      } else if (e.category === name) {
        e.category = target;
      }
    });
    await this.persistMetadataChanges(`${isTag ? "标签" : "分类"}合并成功`);
  },

  async deleteMetadata(name) {
    const isTag = this.metadataType === "tag";
    const count = isTag
      ? this.data.entries.filter((e) => e.tags.includes(name)).length
      : this.data.entries.filter((e) => e.category === name).length;
    const ok = await ConfirmDialog.show(
      isTag
        ? `确定删除标签 "${name}" 吗？将影响 ${count} 条条目。`
        : `确定删除分类 "${name}" 吗？${count} 条条目将变为「未分类」。`,
    );
    if (!ok) return;
    this.data.entries.forEach((e) => {
      if (isTag) e.tags = e.tags.filter((t) => t !== name);
      else if (e.category === name) e.category = "未分类";
    });
    await this.persistMetadataChanges(`${isTag ? "标签" : "分类"}删除成功`);
  },

  async cleanUnusedTags() {
    const used = new Set();
    this.data.entries.forEach((e) => e.tags.forEach((t) => used.add(t)));
    const unused = [...this.tags].filter((t) => !used.has(t));
    if (unused.length === 0) {
      Toast.info("没有未使用的标签");
      return;
    }
    const ok = await ConfirmDialog.show(
      `确定清理 ${unused.length} 个未使用标签吗？`,
    );
    if (!ok) return;
    this.data.entries.forEach((e) => {
      e.tags = e.tags.filter((t) => !unused.includes(t));
    });
    await this.persistMetadataChanges("已清理未使用标签");
  },

  async persistMetadataChanges(message) {
    History.log("数据治理", message);
    if (this.apiMode) {
      for (const entry of this.data.entries) {
        try {
          await API.updateEntry(entry.id, entry);
        } catch (err) {
          console.error("API update failed:", err);
        }
      }
    }
    this.refreshAfterDataChange({ message });
    this.renderMetadataList();
  },

  // ─── Fullscreen Reader ───

  openReader(id) {
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;
    document.getElementById("reader").style.display = "flex";
    document.getElementById("readerHeading").textContent = entry.title;
    document.getElementById("readerCategory").innerHTML =
      "<i data-lucide='folder' style='width:14px;height:14px;'></i> " +
      this.escapeHtml(entry.category);
    document.getElementById("readerTags").innerHTML = entry.tags
      .map((t) => "#" + this.escapeHtml(t))
      .join(" ");
    document.getElementById("readerDate").textContent = entry.createdAt || "-";
    document.getElementById("readerFavBtn").innerHTML = this.isFavorite(id)
      ? '<i data-lucide="star" style="fill:var(--accent-amber);color:var(--accent-amber);"></i>'
      : '<i data-lucide="star"></i>';
    document.getElementById("readerTitle").textContent = entry.title;
    document.getElementById("readerContent").innerHTML =
      '<div class="loading-spinner"><div class="spinner"></div></div>';

    const ft = FileType.detect(entry.path);
    const renderDesc = () => {
      document.getElementById("readerContent").innerHTML =
        entry.description && typeof marked !== "undefined"
          ? marked.parse(entry.description)
          : this.escapeHtml(entry.description || "暂无描述");
    };
    if (entry.path && FileType.isPreviewable(ft)) {
      const base = window.location.pathname.replace(/\/[^\/]*$/, "/");
      const full = base + entry.path;
      if (ft === "markdown") {
        fetch(full, { cache: "no-store" })
          .then((r) => {
            if (!r.ok) throw Error();
            return r.text();
          })
          .then((t) => {
            document.getElementById("readerContent").innerHTML =
              typeof marked !== "undefined"
                ? marked.parse(t)
                : "<pre>" + APP.escapeHtml(t) + "</pre>";
          })
          .catch(() => {
            renderDesc();
          });
      } else if (ft === "image") {
        document.getElementById("readerContent").innerHTML =
          '<img src="' +
          this.escapeHtml(full) +
          '" style="max-width:100%;border-radius:var(--radius-lg);">';
      } else if (ft === "pdf") {
        document.getElementById("readerContent").innerHTML =
          '<iframe src="' +
          this.escapeHtml(full) +
          '" style="width:100%;height:80vh;border:none;border-radius:var(--radius-lg);"></iframe>';
      } else {
        renderDesc();
      }
    } else {
      renderDesc();
    }
    this.currentReaderId = id;
  },

  closeReader() {
    document.getElementById("reader").style.display = "none";
    this.currentReaderId = null;
  },

  // ─── Command Palette ───

  openCommandPalette(mode) {
    const cp = document.getElementById("commandPalette");
    cp.style.display = "flex";
    const input = document.getElementById("cmdInput");
    input.value = mode || "";
    input.focus();
    this.cmdHighlight = -1;
    this.updateCmdMode();
    this.filterCommands();
  },

  closeCommandPalette() {
    document.getElementById("commandPalette").style.display = "none";
    document.getElementById("cmdInput").value = "";
  },

  updateCmdMode() {
    const val = document.getElementById("cmdInput").value;
    const prefix = document.getElementById("cmdPrefix");
    const hint = document.getElementById("cmdModeHint");
    if (val.startsWith(">")) {
      prefix.textContent = ">";
      hint.textContent = "执行命令 · 按 Esc 取消";
    } else if (val.startsWith("@")) {
      prefix.textContent = "@";
      hint.textContent = "按标签筛选";
    } else if (val.startsWith("#")) {
      prefix.textContent = "#";
      hint.textContent = "按分类筛选";
    } else {
      prefix.textContent = "";
      hint.textContent = "输入 > 执行命令 · @ 标签 · # 分类";
    }
  },

  filterCommands() {
    const val = document.getElementById("cmdInput").value;
    const results = document.getElementById("cmdResults");
    if (val.startsWith(">")) {
      const q = val.slice(1).toLowerCase();
      const cmds = [
        { id: "add", label: "添加文件", icon: "plus", hint: "打开添加表单" },
        {
          id: "admin",
          label: "管理面板",
          icon: "settings",
          hint: "打开管理面板",
        },
        { id: "theme", label: "切换主题", icon: "moon", hint: "深色/浅色切换" },
        {
          id: "export",
          label: "导出数据",
          icon: "download",
          hint: "导出为 JSON",
        },
        {
          id: "import",
          label: "导入数据",
          icon: "upload",
          hint: "从 JSON 导入",
        },
        {
          id: "sync",
          label: "检查更新",
          icon: "refresh-cw",
          hint: "从服务端同步",
        },
        {
          id: "deploy",
          label: "部署到 GitHub",
          icon: "rocket",
          hint: "推送并部署 Pages",
        },
        { id: "density-compact", label: "紧凑模式", icon: "list", hint: "⌘1" },
        { id: "density-normal", label: "标准模式", icon: "list", hint: "⌘2" },
        { id: "density-cozy", label: "舒适模式", icon: "list", hint: "⌘3" },
      ].filter(
        (c) => !q || c.label.toLowerCase().includes(q) || c.id.includes(q),
      );
      results.innerHTML = cmds
        .map(
          (c, i) =>
            `<div class="cmd-item ${i === this.cmdHighlight ? "highlighted" : ""}" data-cmd="${c.id}">
          <i data-lucide="${c.icon}" class="cmd-item-icon"></i>
          <span class="cmd-item-text">${c.label}</span>
          <span class="cmd-item-hint">${c.hint}</span>
        </div>`,
        )
        .join("");
      results.querySelectorAll(".cmd-item").forEach((el) => {
        el.addEventListener("click", () => this.execCmd(el.dataset.cmd));
      });
      return;
    }
    if (val.startsWith("@")) {
      const q = val.slice(1).toLowerCase();
      const tags = [...this.tags]
        .filter((t) => t.toLowerCase().includes(q))
        .sort();
      results.innerHTML = tags
        .map(
          (t, i) =>
            `<div class="cmd-item ${i === this.cmdHighlight ? "highlighted" : ""}" data-tag="${t}">
          <i data-lucide="tag" class="cmd-item-icon"></i>
          <span class="cmd-item-text">#${t}</span>
          <span class="cmd-item-badge">标签</span>
        </div>`,
        )
        .join("");
      results.querySelectorAll(".cmd-item").forEach((el) => {
        el.addEventListener("click", () => {
          this.activeTag = el.dataset.tag;
          this.activeCategory = null;
          this.searchQuery = "";
          this.closeCommandPalette();
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
        });
      });
      return;
    }
    if (val.startsWith("#")) {
      const q = val.slice(1).toLowerCase();
      const cats = [...this.categories]
        .filter((c) => c.toLowerCase().includes(q))
        .sort();
      results.innerHTML = cats
        .map(
          (c, i) =>
            `<div class="cmd-item ${i === this.cmdHighlight ? "highlighted" : ""}" data-cat="${c}">
          <i data-lucide="folder" class="cmd-item-icon"></i>
          <span class="cmd-item-text">${c}</span>
          <span class="cmd-item-badge">分类</span>
        </div>`,
        )
        .join("");
      results.querySelectorAll(".cmd-item").forEach((el) => {
        el.addEventListener("click", () => {
          this.activeCategory = el.dataset.cat;
          this.activeTag = null;
          this.searchQuery = "";
          this.closeCommandPalette();
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
        });
      });
      return;
    }
    // Normal search
    if (this.searchIndex) {
      const results2 = this.searchIndex.search(val, {
        prefix: true,
        fuzzy: 0.2,
      });
      const top = results2.slice(0, 8);
      results.innerHTML = top
        .map((r, i) => {
          const e = this.data.entries.find((x) => x.id === r.id);
          if (!e) return "";
          const snippet = this.getSearchSnippet(e.description || e.title, val);
          return `<div class="cmd-item ${i === this.cmdHighlight ? "highlighted" : ""}" data-id="${e.id}">
          <i data-lucide="file-text" class="cmd-item-icon"></i>
          <div class="cmd-item-main">
            <div class="cmd-item-title">${SearchHighlight.highlight(e.title, val)}</div>
            <div class="cmd-item-subtitle">${snippet}</div>
          </div>
          <span class="cmd-item-hint">${this.escapeHtml(e.category)}</span>
        </div>`;
        })
        .join("");
      results.querySelectorAll(".cmd-item").forEach((el) => {
        el.addEventListener("click", () => {
          this.searchQuery = "";
          this.closeCommandPalette();
          document.getElementById("cmdInput").value = "";
          this.selectEntry(parseInt(el.dataset.id));
        });
      });
    }
  },

  getSearchSnippet(text, query) {
    if (!text || !query) return this.escapeHtml(text?.slice(0, 80) || "");
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    const start = Math.max(0, idx === -1 ? 0 : idx - 30);
    const end = Math.min(text.length, start + 120);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    const snippet = text.slice(start, end);
    return prefix + SearchHighlight.highlight(snippet, query) + suffix;
  },

  execCmd(cmd) {
    this.closeCommandPalette();
    if (cmd === "add") document.getElementById("addBtn").click();
    else if (cmd === "admin") document.getElementById("adminToggleBtn").click();
    else if (cmd === "theme") this.toggleTheme();
    else if (cmd === "export") ADMIN.exportJSON();
    else if (cmd === "import")
      document.getElementById("importFileInput").click();
    else if (cmd === "sync") this.checkServerUpdate();
    else if (cmd === "deploy") ADMIN.deployToGitHub();
    else if (cmd === "density-compact") this.setDensity("compact");
    else if (cmd === "density-normal") this.setDensity("normal");
    else if (cmd === "density-cozy") this.setDensity("cozy");
  },

  // ─── Floating Toolbox ───

  showToolbox(x, y, id) {
    const tb = document.getElementById("toolbox");
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;
    const isFav = this.isFavorite(id);
    tb.innerHTML =
      `<button class="toolbox-btn" data-action="fav" data-id="${id}">${isFav ? "★" : "☆"} 收藏</button>` +
      `<button class="toolbox-btn" data-action="read" data-id="${id}"><i data-lucide="maximize-2"></i> 全屏</button>` +
      `<button class="toolbox-btn" data-action="edit" data-id="${id}"><i data-lucide="pencil"></i> 编辑</button>` +
      `<button class="toolbox-btn toolbox-btn-danger" data-action="delete" data-id="${id}"><i data-lucide="trash-2"></i> 删除</button>`;
    tb.style.display = "flex";
    tb.style.left = Math.min(x, window.innerWidth - 320) + "px";
    tb.style.top = Math.min(y, window.innerHeight - 40) + "px";
    tb.dataset.id = id;
    tb.querySelectorAll(".toolbox-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const action = btn.dataset.action;
        const tid = parseInt(btn.dataset.id);
        if (action === "fav") {
          this.toggleFavorite(tid);
          this.hideToolbox();
        } else if (action === "read") {
          this.hideToolbox();
          this.openReader(tid);
        } else if (action === "edit") {
          this.hideToolbox();
          this.openForm(this.data.entries.find((e) => e.id === tid));
        } else if (action === "delete") {
          this.hideToolbox();
          this.deleteEntry(tid);
        }
      });
    });
  },

  hideToolbox() {
    document.getElementById("toolbox").style.display = "none";
  },

  // ─── Bottom Bar / Filters ───

  renderFilterChips() {
    const container = document.getElementById("filterChips");
    const parts = [];
    if (this.activeCategory)
      parts.push({ type: "cat", label: this.activeCategory });
    if (this.activeTag)
      parts.push({ type: "tag", label: "#" + this.activeTag });
    if (this.showFavoritesOnly) parts.push({ type: "fav", label: "★ 收藏" });

    container.innerHTML =
      parts
        .map(
          (p) =>
            `<span class="filter-chip">${p.label}<button class="filter-chip-remove" data-type="${p.type}">×</button></span>`,
        )
        .join("") +
      (parts.length > 0
        ? '<button class="filter-chip-clear" id="clearFilters">清除</button>'
        : "");

  },

  // ─── Density ───

  setDensity(mode) {
    this.density = mode;
    localStorage.setItem("kb_density", mode);
    this.applyDensity();
    this.renderList();
  },

  applyDensity() {
    document.querySelectorAll(".entry-row").forEach((el) => {
      el.className = "entry-row density-" + this.density;
    });
  },

  // ─── Status ───

  updateStatus() {
    const total = this.data.entries.length;
    const filtered = this.getFilteredEntries().length;
    const subtitle = document.getElementById("listSubtitle");
    if (subtitle)
      subtitle.textContent =
        filtered === total
          ? "共 " + total + " 条"
          : "共 " + total + " 条 · 显示 " + filtered + " 条";
  },

  refreshAfterDataChange(options = {}) {
    const {
      message,
      keepDetail = false,
      keepSelection = false,
      refreshAdmin = true,
    } = options;
    this.rebuildMetadata();
    this.setupSearch();
    this.saveData();
    if (!keepDetail && !keepSelection) {
      this.selectedEntryId = null;
      this.focusedEntryId = null;
      this.renderDetail();
    }
    this.renderList();
    this.renderSidebar();
    this.renderFilterChips();
    this.updateStatus();
    this.updateSidebarCounts();
    this.updateListTitle();
    if (refreshAdmin && document.getElementById("adminPanel").style.display !== "none")
      ADMIN.renderTable();
    if (message) Toast.success(message);
  },

  // ─── Events ───

  bindEvents() {
    const addBtn = document.getElementById("addBtn");
    if (addBtn) addBtn.addEventListener("click", () => this.openForm());

    const addBtnTop = document.getElementById("addBtnTop");
    if (addBtnTop) addBtnTop.addEventListener("click", () => this.openForm());

    const sidebarToggle = document.getElementById("sidebarToggle");
    if (sidebarToggle)
      sidebarToggle.addEventListener("click", () => UI.toggleSidebar());

    const adminToggleBtn = document.getElementById("adminToggleBtn");
    if (adminToggleBtn)
      adminToggleBtn.addEventListener("click", () => {
        const p = document.getElementById("adminPanel");
        p.style.display = p.style.display === "none" ? "block" : "none";
        if (p.style.display === "block") ADMIN.renderTable();
      });

    const closeAdminBtn = document.getElementById("closeAdmin");
    if (closeAdminBtn)
      closeAdminBtn.addEventListener("click", () => {
        document.getElementById("adminPanel").style.display = "none";
      });

    const manageTagsBtn = document.getElementById("manageTagsBtn");
    if (manageTagsBtn)
      manageTagsBtn.addEventListener("click", () =>
        this.openMetadataManager("tag"),
      );
    const checkFilesBtn = document.getElementById("checkFilesBtn");
    if (checkFilesBtn)
      checkFilesBtn.addEventListener("click", () =>
        ADMIN.checkFileIntegrity(),
      );
    const manageCatsBtn = document.getElementById("manageCatsBtn");
    if (manageCatsBtn)
      manageCatsBtn.addEventListener("click", () =>
        this.openMetadataManager("category"),
      );

    const metadataClose = document.getElementById("metadataClose");
    if (metadataClose)
      metadataClose.addEventListener("click", () => this.closeMetadataManager());
    const metadataOverlay = document.getElementById("metadataOverlay");
    if (metadataOverlay)
      metadataOverlay.addEventListener("click", () =>
        this.closeMetadataManager(),
      );

    // Clean unused tags button lives inside metadataToolbar, use delegation on metadata modal
    const metadataModal = document.getElementById("metadataModal");
    if (metadataModal) {
      metadataModal.addEventListener("click", (ev) => {
        if (ev.target.closest("#cleanUnusedTagsBtn")) {
          this.cleanUnusedTags();
        }
      });
    }

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle)
      themeToggle.addEventListener("click", () => this.toggleTheme());

    const sortBtn = document.getElementById("sortBtn");
    if (sortBtn)
      sortBtn.addEventListener("click", () => {
        this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
        this.renderList();
      });

    const densityBtn = document.getElementById("densityBtn");
    if (densityBtn)
      densityBtn.addEventListener("click", () => {
        const modes = ["compact", "normal", "cozy"];
        const i = (modes.indexOf(this.density) + 1) % 3;
        this.setDensity(modes[i]);
      });

    // View toggle
    const viewToggle = document.getElementById("viewToggle");
    if (viewToggle) {
      viewToggle.querySelectorAll(".view-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.listView = btn.dataset.view;
          localStorage.setItem("kb_list_view", this.listView);
          viewToggle.querySelectorAll(".view-btn").forEach((b) =>
            b.classList.toggle("active", b === btn),
          );
          this.renderList();
        });
      });
    }

    // Batch mode
    const batchToggleBtn = document.getElementById("batchToggleBtn");
    if (batchToggleBtn)
      batchToggleBtn.addEventListener("click", () =>
        this.setBatchMode(!this.batchMode),
      );
    const batchCancelBtn = document.getElementById("batchCancelBtn");
    if (batchCancelBtn)
      batchCancelBtn.addEventListener("click", () => this.setBatchMode(false));
    const batchDeleteBtn = document.getElementById("batchDeleteBtn");
    if (batchDeleteBtn)
      batchDeleteBtn.addEventListener("click", () => this.batchDelete());
    const batchMoveBtn = document.getElementById("batchMoveBtn");
    if (batchMoveBtn)
      batchMoveBtn.addEventListener("click", () => this.batchMove());
    const batchTagBtn = document.getElementById("batchTagBtn");
    if (batchTagBtn)
      batchTagBtn.addEventListener("click", () => this.batchTag());
    const batchFavBtn = document.getElementById("batchFavBtn");
    if (batchFavBtn)
      batchFavBtn.addEventListener("click", () => this.batchFavorite());
    const batchRestoreBtn = document.getElementById("batchRestoreBtn");
    if (batchRestoreBtn)
      batchRestoreBtn.addEventListener("click", () => this.batchRestore());

    // Detail actions
    const detailReadBtn = document.getElementById("detailReadBtn");
    if (detailReadBtn)
      detailReadBtn.addEventListener("click", () => {
        if (this.selectedEntryId) this.openReader(this.selectedEntryId);
      });
    const detailEditBtn = document.getElementById("detailEditBtn");
    if (detailEditBtn)
      detailEditBtn.addEventListener("click", () => {
        const e = this.data.entries.find((x) => x.id === this.selectedEntryId);
        if (e) this.openForm(e);
      });
    const detailDownloadBtn = document.getElementById("detailDownloadBtn");
    if (detailDownloadBtn)
      detailDownloadBtn.addEventListener("click", () => {
        if (this.selectedEntryId) this.downloadEntry(this.selectedEntryId);
      });
    const detailDeleteBtn = document.getElementById("detailDeleteBtn");
    if (detailDeleteBtn)
      detailDeleteBtn.addEventListener("click", () => {
        if (this.selectedEntryId) this.deleteEntry(this.selectedEntryId);
      });

    // Search triggers
    const globalSearchTrigger = document.getElementById("globalSearchTrigger");
    if (globalSearchTrigger)
      globalSearchTrigger.addEventListener("click", () =>
        this.openCommandPalette(""),
      );
    const sidebarSearchTrigger = document.getElementById("sidebarSearchTrigger");
    if (sidebarSearchTrigger)
      sidebarSearchTrigger.addEventListener("click", () =>
        this.openCommandPalette(""),
      );

    // Collapse categories
    const collapseCategories = document.getElementById("collapseCategories");
    if (collapseCategories)
      collapseCategories.addEventListener("click", () => {
        const tree = document.getElementById("categoryTree");
        const icon = collapseCategories.querySelector("i");
        if (tree) tree.classList.toggle("collapsed");
        if (icon) {
          const isCollapsed = tree?.classList.contains("collapsed");
          icon.setAttribute("data-lucide", isCollapsed ? "chevron-down" : "chevron-up");
          if (typeof lucide !== "undefined") lucide.createIcons();
        }
      });

    // Command palette
    const cmdInput = document.getElementById("cmdInput");
    if (cmdInput)
      cmdInput.addEventListener("input", () => {
        this.cmdHighlight = -1;
        this.updateCmdMode();
        clearTimeout(this._cmdFilterTimer);
        this._cmdFilterTimer = setTimeout(() => this.filterCommands(), 80);
      });
    const cmdOverlay = document.getElementById("cmdOverlay");
    if (cmdOverlay)
      cmdOverlay.addEventListener("click", () => this.closeCommandPalette());

    // Reader
    document
      .getElementById("readerBack")
      .addEventListener("click", () => this.closeReader());
    document
      .getElementById("readerClose")
      .addEventListener("click", () => this.closeReader());
    document.getElementById("readerFavBtn").addEventListener("click", () => {
      if (this.currentReaderId) {
        this.toggleFavorite(this.currentReaderId);
        this.openReader(this.currentReaderId);
      }
    });
    document.getElementById("readerEditBtn").addEventListener("click", () => {
      if (this.currentReaderId) {
        const e = this.data.entries.find((x) => x.id === this.currentReaderId);
        if (e) {
          this.closeReader();
          this.openForm(e);
        }
      }
    });
    document.getElementById("readerDeleteBtn").addEventListener("click", () => {
      if (this.currentReaderId) this.deleteEntry(this.currentReaderId);
    });

    // Form
    document
      .getElementById("formClose")
      .addEventListener("click", () => this.closeForm());
    document
      .getElementById("formOverlay")
      .addEventListener("click", () => this.closeForm());
    document
      .getElementById("formCancel")
      .addEventListener("click", () => this.closeForm());
    document
      .getElementById("entryForm")
      .addEventListener("submit", (e) => this.handleFormSubmit(e));

    // Markdown editor tabs
    const mdTabEdit = document.getElementById("mdTabEdit");
    const mdTabPreview = document.getElementById("mdTabPreview");
    if (mdTabEdit)
      mdTabEdit.addEventListener("click", () => this.setMarkdownTab("edit"));
    if (mdTabPreview)
      mdTabPreview.addEventListener("click", () => this.setMarkdownTab("preview"));
    const formDesc = document.getElementById("formDesc");
    if (formDesc)
      formDesc.addEventListener("input", () => {
        if (document.getElementById("formDescPreview").style.display !== "none")
          this.setMarkdownTab("preview");
      });

    // Form file upload
    const formUpload = document.getElementById("formUpload");
    const formFileInput = document.getElementById("formFileInput");
    if (formUpload && formFileInput) {
      formUpload.addEventListener("click", () => formFileInput.click());
      formUpload.addEventListener("dragover", (e) => {
        e.preventDefault();
        formUpload.classList.add("drag-over");
      });
      formUpload.addEventListener("dragleave", () =>
        formUpload.classList.remove("drag-over"),
      );
      formUpload.addEventListener("drop", (e) => {
        e.preventDefault();
        formUpload.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) this.uploadFormFile(file);
      });
      formFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.uploadFormFile(file);
        e.target.value = "";
      });
    }

    // Export/Import/Deploy
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => ADMIN.openIoModal("export"));
    document
      .getElementById("importBtn")
      .addEventListener("click", () => ADMIN.openIoModal("import"));
    document
      .getElementById("ioClose")
      .addEventListener("click", () => ADMIN.closeIoModal());
    document
      .getElementById("ioOverlay")
      .addEventListener("click", () => ADMIN.closeIoModal());
    document
      .getElementById("ioExportJson")
      .addEventListener("click", () => ADMIN.exportJSON());
    document
      .getElementById("ioExportCsv")
      .addEventListener("click", () => ADMIN.exportCSV());
    document
      .getElementById("ioExportMd")
      .addEventListener("click", () => ADMIN.exportMdPackage());
    document
      .getElementById("ioImportJson")
      .addEventListener("click", () =>
        document.getElementById("ioImportJsonInput").click(),
      );
    document
      .getElementById("ioImportJsonInput")
      .addEventListener("change", (e) => ADMIN.importJSON(e));
    document
      .getElementById("ioImportCsv")
      .addEventListener("click", () =>
        document.getElementById("ioImportCsvInput").click(),
      );
    document
      .getElementById("ioImportCsvInput")
      .addEventListener("change", (e) => ADMIN.importCSV(e));
    document
      .getElementById("ioImportMd")
      .addEventListener("click", () =>
        document.getElementById("ioImportMdInput").click(),
      );
    document
      .getElementById("ioImportMdInput")
      .addEventListener("change", (e) => ADMIN.importMdFolder(e));
    const deployBtn = document.getElementById("deployBtn");
    if (deployBtn)
      deployBtn.addEventListener("click", () => ADMIN.deployToGitHub());

    // Sync buttons
    const checkUpdateBtn = document.getElementById("checkUpdateBtn");
    if (checkUpdateBtn)
      checkUpdateBtn.addEventListener("click", () => this.checkServerUpdate());
    const resetFromServerBtn = document.getElementById("resetFromServerBtn");
    if (resetFromServerBtn)
      resetFromServerBtn.addEventListener("click", () => this.resetFromServer());

    // Click outside toolbox closes it
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".toolbox") && !e.target.closest(".entry-row"))
        this.hideToolbox();
    });

    // Metadata manager event delegation
    const metadataList = document.getElementById("metadataList");
    if (metadataList) {
      metadataList.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-action]");
        if (!btn) return;
        const item = btn.closest(".metadata-item");
        if (!item) return;
        const name = item.dataset.name;
        const action = btn.dataset.action;
        if (action === "rename") this.renameMetadata(name);
        else if (action === "merge") this.mergeMetadata(name);
        else if (action === "delete") this.deleteMetadata(name);
      });
    }

    // Filter chips event delegation
    const filterChips = document.getElementById("filterChips");
    if (filterChips) {
      filterChips.addEventListener("click", (ev) => {
        const remove = ev.target.closest(".filter-chip-remove");
        if (remove) {
          const t = remove.dataset.type;
          if (t === "cat") this.activeCategory = null;
          if (t === "tag") this.activeTag = null;
          if (t === "fav") this.showFavoritesOnly = false;
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
          return;
        }
        if (ev.target.closest("#clearFilters")) {
          this.activeCategory = null;
          this.activeTag = null;
          this.showFavoritesOnly = false;
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
        }
      });
    }

    // Sidebar event delegation
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.addEventListener("click", (ev) => {
        const viewItem = ev.target.closest(".sidebar-item[data-view]");
        if (viewItem) {
          this.currentSidebarView = viewItem.dataset.view;
          this.showFavoritesOnly = viewItem.dataset.view === "favorites";
          this.activeCategory = null;
          this.activeTag = null;
          this.searchQuery = "";
          this.selectedEntryId = null;
          this.focusedEntryId = null;
          this.renderDetail();
          this.renderSidebar();
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
          return;
        }

        const treeItem = ev.target.closest(".tree-item[data-cat]");
        if (treeItem) {
          const cat = treeItem.dataset.cat;
          this.activeCategory = this.activeCategory === cat ? null : cat;
          this.activeTag = null;
          this.searchQuery = "";
          this.renderSidebar();
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
          return;
        }

        const tagPill = ev.target.closest(".tag-pill[data-tag]");
        if (tagPill) {
          const tag = tagPill.dataset.tag;
          this.activeTag = this.activeTag === tag ? null : tag;
          this.activeCategory = null;
          this.searchQuery = "";
          this.renderSidebar();
          this.renderList();
          this.renderFilterChips();
          this.updateStatus();
          return;
        }
      });
    }

    // Entry list event delegation
    const entryList = document.getElementById("entryList");
    if (entryList) {
      entryList.addEventListener("click", (ev) => {
        const row = ev.target.closest(".entry-row");
        if (!row) return;
        const id = parseInt(row.dataset.id);

        const actionBtn = ev.target.closest("[data-action]");
        if (actionBtn) {
          ev.stopPropagation();
          const action = actionBtn.dataset.action;
          const aid = parseInt(actionBtn.dataset.id);
          if (action === "favorite") this.toggleFavorite(aid);
          else if (action === "restore") this.restoreEntry(aid);
          else if (action === "permanent-delete") this.permanentDelete(aid);
          return;
        }

        if (ev.target.closest(".entry-checkbox")) {
          ev.stopPropagation();
          this.toggleSelection(id);
          return;
        }

        if (this.batchMode) {
          ev.stopPropagation();
          this.toggleSelection(id);
          return;
        }

        if (this.currentSidebarView === "recyclebin") {
          this.selectedEntryId = id;
          this.focusedEntryId = id;
          this.renderList();
          return;
        }

        this.selectEntry(id);
      });

      entryList.addEventListener("mouseenter", (ev) => {
        if (this.batchMode) return;
        const row = ev.target.closest(".entry-row");
        if (!row) return;
        const id = parseInt(row.dataset.id);
        const rect = row.getBoundingClientRect();
        this.showToolbox(rect.right - 220, rect.top + 6, id);
      }, true);

      entryList.addEventListener("mouseleave", (ev) => {
        if (this.batchMode) return;
        const row = ev.target.closest(".entry-row");
        if (!row) return;
        setTimeout(() => {
          if (!document.querySelector(".toolbox:hover")) this.hideToolbox();
        }, 150);
      }, true);
    }
  },

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      const cp = document.getElementById("commandPalette");
      if (cp.style.display !== "none") {
        if (e.key === "Escape") {
          this.closeCommandPalette();
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          const highlighted = cp.querySelector(".cmd-item.highlighted");
          if (highlighted) {
            highlighted.click();
            e.preventDefault();
            return;
          }
          const first = cp.querySelector(".cmd-item");
          if (first) {
            first.click();
            e.preventDefault();
            return;
          }
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const items = cp.querySelectorAll(".cmd-item");
          this.cmdHighlight = Math.min(this.cmdHighlight + 1, items.length - 1);
          items.forEach((el, i) =>
            el.classList.toggle("highlighted", i === this.cmdHighlight),
          );
          if (items[this.cmdHighlight])
            items[this.cmdHighlight].scrollIntoView({ block: "nearest" });
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const items = cp.querySelectorAll(".cmd-item");
          this.cmdHighlight = Math.max(this.cmdHighlight - 1, 0);
          items.forEach((el, i) =>
            el.classList.toggle("highlighted", i === this.cmdHighlight),
          );
          return;
        }
        return;
      }

      const reader = document.getElementById("reader");
      if (reader.style.display !== "none") {
        if (e.key === "Escape") {
          this.closeReader();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Escape") {
        if (this.selectedEntryId) {
          this.selectedEntryId = null;
          this.renderList();
          this.renderDetail();
          e.preventDefault();
        } else {
          const ap = document.getElementById("adminPanel");
          if (ap.style.display !== "none") {
            ap.style.display = "none";
            e.preventDefault();
          }
        }
        const fm = document.getElementById("formModal");
        if (fm.style.display !== "none") {
          this.closeForm();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "/" && (!e.target || !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) {
        e.preventDefault();
        this.openCommandPalette("");
        return;
      }
      if (e.key === "?" && (!e.target || !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) {
        e.preventDefault();
        Toast.info("快捷键：/ 搜索，j/k 导航，Enter 打开，x 删除，r 恢复，Space 多选，b 批量模式，Esc 关闭");
        return;
      }

      if (e.key === "1" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.setDensity("compact");
        return;
      }
      if (e.key === "2" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.setDensity("normal");
        return;
      }
      if (e.key === "3" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.setDensity("cozy");
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") {
        if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
        const rows = document.querySelectorAll(".entry-row");
        if (rows.length === 0) return;
        e.preventDefault();
        const down = e.key === "ArrowDown" || e.key === "j";
        this.focusRow(down ? 1 : -1);
        return;
      }

      if (e.key === "Enter") {
        if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
        const focused = document.querySelector(".entry-row.focused");
        if (focused) {
          focused.click();
          e.preventDefault();
        }
        return;
      }

      if (e.key === "x" && (!e.target || !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) {
        e.preventDefault();
        const focused = document.querySelector(".entry-row.focused");
        if (focused) {
          const id = parseInt(focused.dataset.id);
          if (this.currentSidebarView === "recyclebin") {
            this.permanentDelete(id);
          } else {
            this.deleteEntry(id);
          }
        }
        return;
      }

      if (e.key === "r" && (!e.target || !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) {
        e.preventDefault();
        const focused = document.querySelector(".entry-row.focused");
        if (focused && this.currentSidebarView === "recyclebin") {
          this.restoreEntry(parseInt(focused.dataset.id));
        }
        return;
      }

      if (e.key === " " && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        e.preventDefault();
        const focused = document.querySelector(".entry-row.focused");
        if (focused) {
          if (!this.batchMode) this.setBatchMode(true);
          this.toggleSelection(parseInt(focused.dataset.id));
        }
        return;
      }

      if (e.key === "b" && (!e.target || !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))) {
        e.preventDefault();
        this.setBatchMode(!this.batchMode);
        return;
      }
    });
  },

  focusRow(delta) {
    const rows = document.querySelectorAll(".entry-row");
    if (rows.length === 0) return;
    let idx = Array.from(rows).findIndex((r) => parseInt(r.dataset.id) === this.focusedEntryId);
    if (idx < 0) idx = this.selectedEntryId
      ? Array.from(rows).findIndex((r) => parseInt(r.dataset.id) === this.selectedEntryId)
      : -1;
    if (idx < 0) idx = 0;
    idx = Math.min(Math.max(idx + delta, 0), rows.length - 1);
    this.focusedEntryId = parseInt(rows[idx].dataset.id);
    rows.forEach((r) => r.classList.remove("focused"));
    rows[idx].classList.add("focused");
    rows[idx].scrollIntoView({ block: "nearest" });
    rows[idx].focus();
  },

  // ─── CRUD ───

  async uploadFormFile(file) {
    if (!this.apiMode) {
      Toast.warning("请启动本地后端服务后再上传附件");
      return;
    }
    const formUpload = document.getElementById("formUpload");
    if (formUpload) {
      formUpload.innerHTML = `<i data-lucide="loader-2" class="spin"></i><span>上传中...</span>`;
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    try {
      const result = await API.uploadFile(file);
      document.getElementById("formPath").value = result.path;
      const titleInput = document.getElementById("formTitle");
      if (!titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.[^.]+$/, "");
      }
      Toast.success(`上传成功: ${result.filename}`);
      History.log("上传附件", result.filename);
    } catch (err) {
      Toast.error("上传失败: " + err.message);
    } finally {
      if (formUpload) {
        formUpload.innerHTML = `<i data-lucide="upload-cloud"></i><span>点击或拖拽上传附件</span>`;
        if (typeof lucide !== "undefined") lucide.createIcons();
      }
    }
  },

  openForm(entry) {
    const modal = document.getElementById("formModal");
    const select = document.getElementById("formCategory");
    select.innerHTML = '<option value="">请选择分类</option>';
    [...this.categories].sort().forEach((c) => {
      select.innerHTML +=
        '<option value="' +
        this.escapeHtml(c) +
        '">' +
        this.escapeHtml(c) +
        "</option>";
    });
    if (entry) {
      document.getElementById("formTitleText").textContent = "编辑文件";
      document.getElementById("editId").value = entry.id;
      document.getElementById("formTitle").value = entry.title;
      select.value = entry.category;
      document.getElementById("formTags").value = entry.tags.join(", ");
      document.getElementById("formPath").value = entry.path || "";
      document.getElementById("formDesc").value = entry.description || "";
      document.getElementById("formCategoryNew").value = "";
    } else {
      document.getElementById("formTitleText").textContent = "添加文件";
      document.getElementById("editId").value = "";
      document.getElementById("formTitle").value = "";
      select.value = "";
      document.getElementById("formTags").value = "";
      document.getElementById("formPath").value = "";
      document.getElementById("formDesc").value = "";
      document.getElementById("formCategoryNew").value = "";
    }
    this.populatePathSuggestions();
    this.setMarkdownTab("edit");
    modal.style.display = "flex";
  },

  setMarkdownTab(tab) {
    const ta = document.getElementById("formDesc");
    const preview = document.getElementById("formDescPreview");
    const editTab = document.getElementById("mdTabEdit");
    const previewTab = document.getElementById("mdTabPreview");
    if (!ta || !preview || !editTab || !previewTab) return;
    if (tab === "preview") {
      ta.style.display = "none";
      preview.style.display = "block";
      preview.innerHTML =
        typeof marked !== "undefined"
          ? marked.parse(ta.value || "*暂无内容*")
          : this.escapeHtml(ta.value || "*暂无内容*");
      editTab.classList.remove("active");
      previewTab.classList.add("active");
    } else {
      ta.style.display = "block";
      preview.style.display = "none";
      editTab.classList.add("active");
      previewTab.classList.remove("active");
    }
  },

  closeForm() {
    document.getElementById("formModal").style.display = "none";
  },

  async handleFormSubmit(e) {
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
    const title = titleInput.value.trim();

    if (this.apiMode) {
      try {
        if (editId) {
          const updated = await API.updateEntry(parseInt(editId), {
            title,
            category,
            tags,
            path,
            description,
          });
          const idx = this.data.entries.findIndex((en) => en.id === updated.id);
          if (idx !== -1) this.data.entries[idx] = updated;
          Toast.success("更新成功");
        } else {
          const created = await API.createEntry({
            title,
            category,
            tags,
            path,
            description,
            createdAt: new Date().toISOString().slice(0, 10),
            type: FileType.detect(path),
          });
          this.data.entries.push(created);
          this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
          Toast.success("添加成功");
        }
      } catch (err) {
        Toast.error("保存失败: " + err.message);
        return;
      }
    } else {
      if (editId) {
        const entry = this.data.entries.find((en) => en.id === parseInt(editId));
        if (entry) {
          entry.title = title;
          entry.category = category;
          entry.tags = tags;
          entry.path = path;
          entry.description = description;
          this.categories.add(category);
          tags.forEach((t) => this.tags.add(t));
        }
      } else {
        this.data.entries.push({
          id: this.nextId++,
          title,
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
    }

    this.closeForm();
    this.refreshAfterDataChange({ keepDetail: true });
    History.log(editId ? "更新条目" : "创建条目", title);
  },

  async deleteEntry(id) {
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;
    const ok = await ConfirmDialog.show("确定要删除「" + entry.title + "」吗？删除后可从回收站恢复。");
    if (!ok) return;

    if (this.apiMode) {
      try {
        await API.deleteEntry(id);
      } catch (err) {
        Toast.error("删除失败: " + err.message);
        return;
      }
    }

    this.data.entries = this.data.entries.filter((e) => e.id !== id);
    entry.deletedAt = new Date().toISOString();
    if (!this.data.deletedEntries) this.data.deletedEntries = [];
    this.data.deletedEntries.push(entry);

    const keepDetail = this.selectedEntryId !== id;
    if (!keepDetail) {
      this.selectedEntryId = null;
      this.focusedEntryId = null;
    }
    this.refreshAfterDataChange({ keepDetail });
    if (this.currentReaderId === id) this.closeReader();
    History.log("删除条目", entry.title);
  },

  async restoreEntry(id) {
    const idx = (this.data.deletedEntries || []).findIndex((e) => e.id === id);
    if (idx === -1) return;
    const entry = this.data.deletedEntries[idx];

    const existingId = this.data.entries.find((e) => e.id === id);
    if (existingId) {
      entry.id = this.nextId++;
    }
    delete entry.deletedAt;

    if (this.apiMode) {
      try {
        const created = await API.createEntry(entry);
        this.data.entries.push(created);
        this.data.deletedEntries.splice(idx, 1);
        Toast.success("恢复成功");
      } catch (err) {
        Toast.error("恢复失败: " + err.message);
        return;
      }
    } else {
      this.data.entries.push(entry);
    this.data.deletedEntries.splice(idx, 1);
    Toast.success("恢复成功");
  }

    this.refreshAfterDataChange({ message: "恢复成功" });
    History.log("恢复条目", entry.title);
  },

  async permanentDelete(id) {
    const entry = (this.data.deletedEntries || []).find((e) => e.id === id);
    if (!entry) return;
    const ok = await ConfirmDialog.show(
      "确定要永久删除「" + entry.title + "」吗？此操作不可撤销。",
    );
    if (!ok) return;

    this.data.deletedEntries = (this.data.deletedEntries || []).filter(
      (e) => e.id !== id,
    );
    this.selectedEntryId = null;
    this.focusedEntryId = null;
    this.refreshAfterDataChange({ message: "已永久删除" });
    History.log("永久删除", entry.title);
  },

  downloadEntry(id) {
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry || !entry.path) {
      Toast.warning("无文件可下载");
      return;
    }
    const base = window.location.pathname.replace(/\/[^\/]*$/, "/");
    const a = document.createElement("a");
    a.href = base + entry.path;
    a.download = entry.path.split("/").pop();
    a.click();
  },

  saveData() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  },

  loadFavorites() {
    try {
      const stored = localStorage.getItem("kb_favorites");
      this.favorites = new Set(stored ? JSON.parse(stored) : []);
    } catch (e) {
      this.favorites = new Set();
    }
  },

  toggleFavorite(id) {
    const isFav = this.favorites.has(id);
    if (isFav) this.favorites.delete(id);
    else this.favorites.add(id);
    localStorage.setItem("kb_favorites", JSON.stringify([...this.favorites]));

    const favHtml = isFav
      ? '<i data-lucide="star"></i>'
      : '<i data-lucide="star" style="fill:var(--accent-amber);color:var(--accent-amber);"></i>';

    const rowFav = document.querySelector(`.entry-row[data-id="${id}"] .entry-fav`);
    if (rowFav) {
      rowFav.classList.toggle("favorited", !isFav);
      rowFav.innerHTML = favHtml;
    }

    if (this.selectedEntryId === id) {
      const detailFav = document.getElementById("detailFavBtn");
      if (detailFav) {
        detailFav.classList.toggle("favorited", !isFav);
        detailFav.innerHTML = isFav
          ? '<i data-lucide="star"></i> 收藏'
          : '<i data-lucide="star" style="fill:var(--accent-amber);color:var(--accent-amber);"></i> 已收藏';
      }
    }

    if (this.currentReaderId === id) {
      const readerFav = document.getElementById("readerFavBtn");
      if (readerFav) readerFav.innerHTML = favHtml;
    }

    if (typeof lucide !== "undefined") lucide.createIcons();
    this.updateSidebarCounts();
  },

  isFavorite(id) {
    return this.favorites.has(id);
  },

  escapeHtml(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  },

  highlightText(text) {
    if (!this.searchQuery || !text) return this.escapeHtml(text);
    return SearchHighlight.highlight(text, this.searchQuery);
  },

  getLucideIcon(type) {
    return (
      {
        markdown: "file-text",
        image: "image",
        pdf: "file-text",
        video: "video",
        audio: "music",
        other: "file",
      }[type] || "file"
    );
  },

  detectFileProtocol() {
    if (window.location.protocol === "file:") {
      const banner = document.getElementById("protocolWarning");
      if (banner) banner.style.display = "flex";
    }
  },

  registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  },

  loadUrlState() {
    const p = new URLSearchParams(window.location.search);
    this.searchQuery = p.get("q") || "";
    this.activeCategory = p.get("cat") || null;
    this.activeTag = p.get("tag") || null;
    this.showFavoritesOnly = p.get("fav") === "1";
  },

  updateUrlState() {
    const p = new URLSearchParams();
    if (this.searchQuery) p.set("q", this.searchQuery);
    if (this.activeCategory) p.set("cat", this.activeCategory);
    if (this.activeTag) p.set("tag", this.activeTag);
    if (this.showFavoritesOnly) p.set("fav", "1");
    history.replaceState(
      {},
      "",
      p.toString() ? "?" + p.toString() : window.location.pathname,
    );
  },

  setupOfflineDetection() {
    window.addEventListener("online", () => {
      document.body.classList.remove("offline");
      Toast.success("网络已恢复");
    });
    window.addEventListener("offline", () => {
      document.body.classList.add("offline");
      Toast.warning("网络已断开");
    });
    if (!navigator.onLine) document.body.classList.add("offline");
  },

  async checkServerUpdate() {
    try {
      const resp = await fetch("data/index.json?v=" + Date.now());
      if (!resp.ok) return;
      const serverData = await resp.json();
      const sv = serverData.generatedAt || serverData.version || "";
      const lv = this.data.generatedAt || this.data.version || "";
      if (sv > lv) {
        this.serverUpdate = serverData;
        Toast.show(
          "服务端有更新（" + serverData.entries.length + " 条）",
          "info",
          8000,
          { label: "合并更新", callback: () => this.mergeServerUpdate() },
        );
      } else {
        Toast.info("已是最新");
      }
    } catch (e) {
      /* silent */
    }
  },

  mergeServerUpdate() {
    if (!this.serverUpdate) return;
    const localIds = new Set(this.data.entries.map((e) => e.id));
    let added = 0;
    this.serverUpdate.entries.forEach((entry) => {
      if (!localIds.has(entry.id)) {
        this.data.entries.push(entry);
        localIds.add(entry.id);
        added++;
      }
    });
    this.data.generatedAt = this.serverUpdate.generatedAt;
    this.serverUpdate = null;
    this.rebuildMetadata();
    this.setupSearch();
    this.saveData();
    this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
    this.renderList();
    this.renderFilterChips();
    this.updateStatus();
    if (document.getElementById("adminPanel").style.display !== "none")
      ADMIN.renderTable();
    Toast.success("合并完成，新增 " + added + " 条");
  },

  async resetFromServer() {
    if (
      !(await ConfirmDialog.show(
        "将丢弃所有本地修改，重置为服务端数据。确定继续？",
      ))
    )
      return;
    try {
      const resp = await fetch("data/index.json?v=" + Date.now());
      if (!resp.ok) throw Error("获取失败");
      this.data = await resp.json();
      this.rebuildMetadata();
      this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
      this.serverUpdate = null;
      this.setupSearch();
      this.saveData();
      this.renderList();
      this.renderFilterChips();
      this.updateStatus();
      if (document.getElementById("adminPanel").style.display !== "none")
        ADMIN.renderTable();
      Toast.success("已重置");
    } catch (err) {
      Toast.error("重置失败");
    }
  },

  initTheme() {
    const saved = localStorage.getItem("kb_theme");
    const isDark = saved ? saved === "dark" : false;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    this.updateThemeIcon(isDark);
  },

  toggleTheme() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const next = !isDark;
    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light",
    );
    localStorage.setItem("kb_theme", next ? "dark" : "light");
    this.updateThemeIcon(next);
  },

  updateThemeIcon(isDark) {
    const icon = document.getElementById("themeIcon");
    if (!icon) return;
    icon.setAttribute("data-lucide", isDark ? "sun" : "moon");
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  populatePathSuggestions() {
    const dl = document.getElementById("pathSuggestions");
    if (!dl) return;
    dl.innerHTML = [
      ...new Set(this.data.entries.map((e) => e.path).filter(Boolean)),
    ]
      .map((p) => '<option value="' + this.escapeHtml(p) + '">')
      .join("");
  },
};

document.addEventListener("DOMContentLoaded", () => APP.init());
