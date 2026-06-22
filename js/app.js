﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿const APP = {
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
  expandedId: null,
  cmdHighlight: -1,
  apiMode: false,

  async init() {
    this.registerSW();
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
    this.renderList();
    this.updateStatus();
    this.renderFilterChips();
    this.initTheme();
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  async loadData() {
    if (this.apiMode) {
      try {
        this.data = await API.listEntries();
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
      this.rebuildMetadata();
      this.nextId = Math.max(...this.data.entries.map((e) => e.id), 0) + 1;
      this.saveData();
    } catch (err) {
      console.error("Failed to load data:", err);
      this.data = { version: "1.0.0", siteTitle: "知识库", entries: [] };
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
      this.searchIndex.add({
        id: e.id,
        title: e.title,
        description: e.description || "",
        tags: e.tags.join(" "),
        category: e.category,
      });
    });
  },

  getFilteredEntries() {
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
    return entries;
  },

  // ─── Rendering ───

  renderList() {
    const list = document.getElementById("entryList");
    const entries = this.getFilteredEntries();
    if (entries.length === 0) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = entries.map((e, i) => this.renderEntryRow(e, i)).join("");
    list.querySelectorAll(".entry-row").forEach((row) => {
      const id = parseInt(row.dataset.id);
      row.addEventListener("click", (ev) => {
        if (
          ev.target.closest(".entry-fav") ||
          ev.target.closest(".entry-expand-actions") ||
          ev.target.closest(".entry-expand-preview")
        )
          return;
        if (this.expandedId === id) {
          this.collapseEntry();
        } else {
          this.expandEntry(id);
        }
      });
      row.addEventListener("mouseenter", (ev) => {
        const rect = row.getBoundingClientRect();
        this.showToolbox(rect.right - 200, rect.top + 4, id);
      });
      row.addEventListener("mouseleave", () => {
        setTimeout(() => {
          if (!document.querySelector(".toolbox:hover")) this.hideToolbox();
        }, 150);
      });
    });
    this.updateStatus();
    this.updateUrlState();
  },

  renderEntryRow(entry, idx) {
    const isFav = this.favorites.has(entry.id);
    const icon = this.getLucideIcon(FileType.detect(entry.path));
    const cat = this.escapeHtml(entry.category);
    const date = entry.createdAt || "";
    const title = this.highlightText(entry.title);
    const desc = this.highlightText(entry.description || "");
    const tags = entry.tags
      .map((t) => `<span class="entry-tag">#${this.highlightText(t)}</span>`)
      .join("");

    if (this.density === "compact") {
      return `<div class="entry-row density-compact" data-id="${entry.id}" role="listitem">
        <div class="entry-main">
          <i data-lucide="${icon}" class="entry-icon"></i>
          <span class="entry-title">${title}</span>
          <span class="entry-category">${cat}</span>
          <span class="entry-date">${date}</span>
          <button class="entry-fav ${isFav ? "favorited" : ""}" onclick="event.stopPropagation();APP.toggleFavorite(${entry.id})">${isFav ? "★" : "☆"}</button>
        </div>
        <div class="entry-expand" id="expand-${entry.id}"><div class="entry-expand-inner"></div></div>
      </div>`;
    }
    if (this.density === "cozy") {
      return `<div class="entry-row density-cozy" data-id="${entry.id}" role="listitem">
        <div class="entry-main">
          <div class="entry-top">
            <i data-lucide="${icon}" class="entry-icon"></i>
            <span class="entry-title">${title}</span>
            <span class="entry-category">${cat}</span>
          </div>
          <div class="entry-desc">${desc || "暂无描述"}</div>
          <div class="entry-bottom">
            <div class="entry-tags">${tags}</div>
            <span class="entry-date">${date}</span>
            <button class="entry-fav ${isFav ? "favorited" : ""}" onclick="event.stopPropagation();APP.toggleFavorite(${entry.id})">${isFav ? "★" : "☆"}</button>
          </div>
        </div>
        <div class="entry-expand" id="expand-${entry.id}"><div class="entry-expand-inner"></div></div>
      </div>`;
    }
    // default: normal
    return `<div class="entry-row density-normal" data-id="${entry.id}" role="listitem">
      <div class="entry-main">
        <i data-lucide="${icon}" class="entry-icon"></i>
        <span class="entry-title">${title}</span>
        <span class="entry-category">${cat}</span>
        <div class="entry-tags">${tags}</div>
        <span class="entry-date">${date}</span>
        <button class="entry-fav ${isFav ? "favorited" : ""}" onclick="event.stopPropagation();APP.toggleFavorite(${entry.id})">${isFav ? "★" : "☆"}</button>
      </div>
      <div class="entry-expand" id="expand-${entry.id}"><div class="entry-expand-inner"></div></div>
    </div>`;
  },

  expandEntry(id) {
    if (this.expandedId === id) return;
    if (this.expandedId) this.collapseEntry();
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;
    const expand = document.getElementById("expand-" + id);
    if (!expand) return;
    this.expandedId = id;

    const inner = expand.querySelector(".entry-expand-inner");
    inner.innerHTML = `
      <div class="entry-expand-desc">${this.escapeHtml(entry.description || "暂无描述")}</div>
      ${entry.path ? `<div class="entry-expand-path"><span>${this.escapeHtml(entry.path)}</span></div>` : ""}
      <div class="entry-expand-preview" id="preview-${id}"><div class="loading-spinner"><div class="spinner"></div><p>加载中...</p></div></div>
      <div class="entry-expand-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();APP.openReader(${id})"><i data-lucide="maximize-2"></i> 全屏</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();APP.openForm(APP.data.entries.find(e=>e.id===${id}))"><i data-lucide="pencil"></i> 编辑</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();APP.deleteEntry(${id})"><i data-lucide="trash-2"></i> 删除</button>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();APP.downloadEntry(${id})"><i data-lucide="download"></i> 下载</button>
      </div>`;
    expand.classList.add("open");

    const row = expand.closest(".entry-row");
    if (row) row.classList.add("expanded");

    this.loadPreview(id);
  },

  collapseEntry() {
    if (!this.expandedId) return;
    const expand = document.getElementById("expand-" + this.expandedId);
    if (expand) {
      expand.classList.remove("open");
      const row = expand.closest(".entry-row");
      if (row) row.classList.remove("expanded");
    }
    this.expandedId = null;
  },

  loadPreview(id) {
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;
    const el = document.getElementById("preview-" + id);
    if (!el) return;
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
              : "<pre>" + APP.escapeHtml(t) + "</pre>";
        })
        .catch(() => {
          el.innerHTML =
            '<p style="color:var(--text-tertiary);font-size:13px;">文件不存在</p>';
        });
    } else if (ft === "image") {
      el.innerHTML =
        '<img src="' +
        this.escapeHtml(full) +
        '" style="max-width:100%;border-radius:var(--radius);">';
    } else if (ft === "pdf") {
      el.innerHTML =
        '<iframe src="' +
        this.escapeHtml(full) +
        '" style="width:100%;height:400px;border:none;border-radius:var(--radius);"></iframe>';
    } else if (ft === "video") {
      el.innerHTML =
        '<video controls style="max-width:100%;border-radius:var(--radius);"><source src="' +
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
      ? '<i data-lucide="star" style="fill:var(--accent);color:var(--accent);"></i>'
      : '<i data-lucide="star"></i>';
    document.getElementById("readerTitle").textContent = entry.title;
    document.getElementById("readerContent").innerHTML =
      '<div class="loading-spinner"><div class="spinner"></div></div>';

    this.collapseEntry();

    const ft = FileType.detect(entry.path);
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
            document.getElementById("readerContent").innerHTML =
              '<p style="color:var(--text-tertiary)">文件不存在</p>';
          });
      } else if (ft === "image") {
        document.getElementById("readerContent").innerHTML =
          '<img src="' +
          this.escapeHtml(full) +
          '" style="max-width:100%;border-radius:var(--radius-lg);">';
      } else {
        document.getElementById("readerContent").innerHTML =
          '<p style="color:var(--text-tertiary)">此类型暂不支持预览</p>';
      }
    } else {
      document.getElementById("readerContent").innerHTML =
        '<p style="color:var(--text-tertiary)">此类型暂不支持预览</p>';
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
          return `<div class="cmd-item ${i === this.cmdHighlight ? "highlighted" : ""}" data-id="${e.id}">
          <i data-lucide="file-text" class="cmd-item-icon"></i>
          <span class="cmd-item-text">${this.escapeHtml(e.title)}</span>
          <span class="cmd-item-hint">${this.escapeHtml(e.category)}</span>
        </div>`;
        })
        .join("");
      results.querySelectorAll(".cmd-item").forEach((el) => {
        el.addEventListener("click", () => {
          this.searchQuery = "";
          this.closeCommandPalette();
          document.getElementById("cmdInput").value = "";
          this.expandEntry(parseInt(el.dataset.id));
        });
      });
    }
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

    container.querySelectorAll(".filter-chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.type;
        if (t === "cat") this.activeCategory = null;
        if (t === "tag") this.activeTag = null;
        if (t === "fav") this.showFavoritesOnly = false;
        this.renderList();
        this.renderFilterChips();
        this.updateStatus();
      });
    });
    const clearBtn = document.getElementById("clearFilters");
    if (clearBtn)
      clearBtn.addEventListener("click", () => {
        this.activeCategory = null;
        this.activeTag = null;
        this.showFavoritesOnly = false;
        this.renderList();
        this.renderFilterChips();
        this.updateStatus();
      });
  },

  toggleFilterPanel() {
    const panel = document.getElementById("filterPanel");
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    if (!isOpen) this.renderFilterPanel();
  },

  renderFilterPanel() {
    const catContainer = document.getElementById("filterCategories");
    const tagContainer = document.getElementById("filterTags");

    catContainer.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className =
      "filter-option" + (!this.activeCategory ? " active" : "");
    allBtn.textContent = "全部";
    allBtn.addEventListener("click", () => {
      this.activeCategory = null;
      this.currentPage = 1;
      this.renderFilterPanel();
      this.renderList();
      this.renderFilterChips();
      this.updateStatus();
    });
    catContainer.appendChild(allBtn);
    [...this.categories].sort().forEach((c) => {
      const btn = document.createElement("button");
      btn.className =
        "filter-option" + (this.activeCategory === c ? " active" : "");
      btn.textContent = c;
      btn.addEventListener("click", () => {
        this.activeCategory = this.activeCategory === c ? null : c;
        this.currentPage = 1;
        this.renderFilterPanel();
        this.renderList();
        this.renderFilterChips();
        this.updateStatus();
      });
      catContainer.appendChild(btn);
    });

    tagContainer.innerHTML = "";
    const tagAll = document.createElement("button");
    tagAll.className = "filter-tag" + (!this.activeTag ? " active" : "");
    tagAll.textContent = "全部";
    tagAll.addEventListener("click", () => {
      this.activeTag = null;
      this.currentPage = 1;
      this.renderFilterPanel();
      this.renderList();
      this.renderFilterChips();
      this.updateStatus();
    });
    tagContainer.appendChild(tagAll);
    [...this.tags].sort().forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "filter-tag" + (this.activeTag === t ? " active" : "");
      btn.textContent = "#" + t;
      btn.addEventListener("click", () => {
        this.activeTag = this.activeTag === t ? null : t;
        this.currentPage = 1;
        this.renderFilterPanel();
        this.renderList();
        this.renderFilterChips();
        this.updateStatus();
      });
      tagContainer.appendChild(btn);
    });
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
    const st = document.getElementById("statusText");
    if (st)
      st.textContent =
        filtered === total
          ? "共 " + total + " 条"
          : "共 " + total + " 条 · 显示 " + filtered + " 条";
  },

  // ─── Events ───

  bindEvents() {
    const addBtn = document.getElementById("addBtn");
    if (addBtn) addBtn.addEventListener("click", () => this.openForm());

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

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle)
      themeToggle.addEventListener("click", () => this.toggleTheme());

    const filterToggleBtn = document.getElementById("filterToggleBtn");
    if (filterToggleBtn)
      filterToggleBtn.addEventListener("click", () => this.toggleFilterPanel());

    const sortBtn = document.getElementById("sortBtn");
    if (sortBtn)
      sortBtn.addEventListener("click", () => {
        this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
        document.getElementById("sortLabel").textContent =
          this.sortDirection === "desc" ? "最新" : "最早";
        this.renderList();
      });

    const densityBtn = document.getElementById("densityBtn");
    if (densityBtn)
      densityBtn.addEventListener("click", () => {
        const modes = ["compact", "normal", "cozy"];
        const i = (modes.indexOf(this.density) + 1) % 3;
        this.setDensity(modes[i]);
      });

    // Command palette
    const cmdInput = document.getElementById("cmdInput");
    if (cmdInput)
      cmdInput.addEventListener("input", () => {
        this.cmdHighlight = -1;
        this.updateCmdMode();
        this.filterCommands();
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

    // Export/Import/Deploy
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => ADMIN.exportJSON());
    document
      .getElementById("importBtn")
      .addEventListener("click", () =>
        document.getElementById("importFileInput").click(),
      );
    document
      .getElementById("importFileInput")
      .addEventListener("change", (e) => ADMIN.importJSON(e));
    const deployBtn = document.getElementById("deployBtn");
    if (deployBtn)
      deployBtn.addEventListener("click", () => ADMIN.deployToGitHub());

    // Sync buttons
    document
      .getElementById("checkUpdateBtn")
      .addEventListener("click", () => this.checkServerUpdate());
    document
      .getElementById("resetFromServerBtn")
      .addEventListener("click", () => this.resetFromServer());

    // Click outside toolbox closes it
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".toolbox") && !e.target.closest(".entry-row"))
        this.hideToolbox();
    });
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
        if (this.expandedId) {
          this.collapseEntry();
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

      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.openCommandPalette("");
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

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const rows = document.querySelectorAll(".entry-row");
        if (rows.length === 0) return;
        e.preventDefault();
        let idx = Array.from(rows).findIndex((r) =>
          r.classList.contains("focused"),
        );
        if (idx < 0) idx = -1;
        idx =
          e.key === "ArrowDown"
            ? Math.min(idx + 1, rows.length - 1)
            : Math.max(idx - 1, 0);
        rows.forEach((r) => r.classList.remove("focused"));
        rows[idx].classList.add("focused");
        rows[idx].scrollIntoView({ block: "nearest" });
        rows[idx].focus();
      }

      if (e.key === "Enter") {
        const focused = document.querySelector(".entry-row.focused");
        if (focused) {
          focused.click();
          e.preventDefault();
        }
      }
    });
  },

  // ─── CRUD ───

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
    modal.style.display = "flex";
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

    this.rebuildMetadata();
    this.setupSearch();
    this.saveData();
    this.closeForm();
    this.renderList();
    this.renderFilterChips();
    this.updateStatus();
    if (document.getElementById("adminPanel").style.display !== "none")
      ADMIN.renderTable();
  },

  async deleteEntry(id) {
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return;
    const ok = await ConfirmDialog.show("确定要删除「" + entry.title + "」吗？");
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
    this.rebuildMetadata();
    this.setupSearch();
    this.saveData();
    this.renderList();
    this.renderFilterChips();
    this.updateStatus();
    if (this.expandedId === id) this.collapseEntry();
    if (this.currentReaderId === id) this.closeReader();
    if (document.getElementById("adminPanel").style.display !== "none")
      ADMIN.renderTable();
    Toast.success("删除成功");
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
    if (this.favorites.has(id)) this.favorites.delete(id);
    else this.favorites.add(id);
    localStorage.setItem("kb_favorites", JSON.stringify([...this.favorites]));
    this.renderList();
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

  registerSW() {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("sw.js").catch(() => {});
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
    if (
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.setAttribute("data-theme", "dark");
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
