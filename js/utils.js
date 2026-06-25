// ====================================
// utils.js - Utility Modules
// ====================================

// Toast notification system
const Toast = {
  container: null,
  queue: [],
  maxVisible: 3,

  init() {
    this.container = document.getElementById("toastContainer");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toastContainer";
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  },

  show(message, type = "info", duration = 3000) {
    this.init();
    const icons = {
      success: "\u2713",
      error: "\u2717",
      warning: "\u26A0",
      info: "\u2139",
    };
    const toast = document.createElement("div");
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
        toast.classList.add("toast-exit");
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  success(msg) {
    this.show(msg, "success");
  },
  error(msg) {
    this.show(msg, "error", 5000);
  },
  warning(msg) {
    this.show(msg, "warning");
  },
  info(msg) {
    this.show(msg, "info");
  },
};

// Confirmation dialog
const ConfirmDialog = {
  overlay: null,
  callback: null,

  init() {
    this.overlay = document.getElementById("confirmOverlay");
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.id = "confirmOverlay";
      this.overlay.className = "modal";
      this.overlay.style.display = "none";
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
      this.overlay
        .querySelector("#confirmCancel")
        .addEventListener("click", () => this.hide());
      this.overlay
        .querySelector("#confirmBg")
        .addEventListener("click", () => this.hide());
    }
  },

  show(message) {
    this.init();
    return new Promise((resolve) => {
      this.callback = resolve;
      document.getElementById("confirmMessage").textContent = message;
      this.overlay.style.display = "flex";
      document.getElementById("confirmOk").onclick = () => {
        this.hide();
        resolve(true);
      };
    });
  },

  hide() {
    this.overlay.style.display = "none";
    if (this.callback) {
      this.callback(false);
      this.callback = null;
    }
  },
};

// Search highlight utility
const SearchHighlight = {
  highlight(text, query) {
    if (!query || !text) return "";
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return this._escapeHtml(text).replace(
      regex,
      '<mark class="search-highlight">$1</mark>',
    );
  },

  _escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },
};

// File type detection
const FileType = {
  MARKDOWN: ["md", "markdown", "mdx"],
  IMAGE: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
  PDF: ["pdf"],
  VIDEO: ["mp4", "webm", "ogg", "mov", "avi"],
  AUDIO: ["mp3", "wav", "ogg", "flac", "aac"],

  detect(path) {
    if (!path) return "unknown";
    const ext = path.split(".").pop().toLowerCase();
    if (this.MARKDOWN.includes(ext)) return "markdown";
    if (this.IMAGE.includes(ext)) return "image";
    if (this.PDF.includes(ext)) return "pdf";
    if (this.VIDEO.includes(ext)) return "video";
    if (this.AUDIO.includes(ext)) return "audio";
    return "other";
  },

  getIcon(type) {
    const icons = {
      markdown: "\uD83D\uDCC4",
      image: "\uD83D\uDCDE",
      pdf: "\uD83D\uDCC6",
      video: "\uD83C\uDFAC",
      audio: "\uD83C\uDFB5",
      other: "\uD83D\uDCC1",
    };
    return icons[type] || icons.other;
  },

  isPreviewable(type) {
    return ["markdown", "image", "pdf", "video", "audio"].includes(type);
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
  KEY: "knowledgeBaseSearchHistory",
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
    const filtered = history.filter((h) => h !== query);
    filtered.unshift(query);
    // Limit
    const trimmed = filtered.slice(0, this.MAX_ITEMS);
    localStorage.setItem(this.KEY, JSON.stringify(trimmed));
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};

// Prompt dialog
const PromptDialog = {
  overlay: null,
  callback: null,

  init() {
    this.overlay = document.getElementById("promptOverlay");
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.id = "promptOverlay";
      this.overlay.className = "modal";
      this.overlay.style.display = "none";
      this.overlay.innerHTML = `
        <div class="modal-overlay" id="promptBg"></div>
        <div class="modal-content" style="max-width:420px;">
          <div class="modal-header">
            <h2 id="promptTitle" style="font-size:18px;">提示</h2>
          </div>
          <div style="padding:0 var(--space-5) var(--space-4);">
            <p id="promptMessage" style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;"></p>
            <input type="text" id="promptInput" class="new-category-input" style="width:100%;height:36px;padding:0 var(--space-3);border:1px solid var(--border);border-radius:var(--radius-md);font-size:14px;background:var(--bg-secondary);color:var(--text-primary);" />
            <datalist id="promptSuggestions"></datalist>
            <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
              <button class="btn btn-secondary" id="promptCancel">取消</button>
              <button class="btn btn-primary" id="promptOk">确定</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(this.overlay);
      this.overlay.querySelector("#promptCancel").addEventListener("click", () => this.hide());
      this.overlay.querySelector("#promptBg").addEventListener("click", () => this.hide());
      this.overlay.querySelector("#promptInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.overlay.querySelector("#promptOk").click();
        }
      });
    }
  },

  show(title, message, suggestions = []) {
    this.init();
    return new Promise((resolve) => {
      this.callback = resolve;
      document.getElementById("promptTitle").textContent = title;
      document.getElementById("promptMessage").textContent = message;
      const input = document.getElementById("promptInput");
      input.value = "";
      input.setAttribute("list", suggestions.length > 0 ? "promptSuggestions" : "");
      const dl = document.getElementById("promptSuggestions");
      if (dl) dl.innerHTML = suggestions.map((s) => `<option value="${s}">`).join("");
      this.overlay.style.display = "flex";
      input.focus();
      document.getElementById("promptOk").onclick = () => {
        const val = input.value.trim();
        this.hide();
        resolve(val);
      };
    });
  },

  hide() {
    this.overlay.style.display = "none";
    if (this.callback) {
      this.callback(null);
      this.callback = null;
    }
  },
};

// Reader progress manager
const ReaderProgress = {
  KEY: "kb_reader_progress",

  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch {
      return {};
    }
  },

  _write(map) {
    localStorage.setItem(this.KEY, JSON.stringify(map));
  },

  save(id, scrollTop, scrollHeight, clientHeight) {
    if (!id) return;
    const map = this._read();
    map[id] = {
      scrollTop,
      percent: scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0,
      updatedAt: Date.now(),
    };
    this._write(map);
  },

  load(id) {
    if (!id) return null;
    const map = this._read();
    return map[id] || null;
  },

  remove(id) {
    const map = this._read();
    delete map[id];
    this._write(map);
  },
};

// Operation history manager
const History = {
  KEY: "knowledgeBaseHistory",
  MAX_ITEMS: 50,

  log(action, detail = "") {
    const items = this.getHistory();
    items.unshift({
      action,
      detail,
      time: new Date().toISOString(),
    });
    localStorage.setItem(this.KEY, JSON.stringify(items.slice(0, this.MAX_ITEMS)));
  },

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },

  formatTime(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
};

// Sort helper
const Sorter = {
  sortByDate(entries, ascending = false) {
    return [...entries].sort((a, b) => {
      const da = a.createdAt || "";
      const db = b.createdAt || "";
      return ascending ? da.localeCompare(db) : db.localeCompare(da);
    });
  },

  sortByTitle(entries, ascending = true) {
    return [...entries].sort((a, b) => {
      return ascending
        ? a.title.localeCompare(b.title, "zh-CN")
        : b.title.localeCompare(a.title, "zh-CN");
    });
  },
};

// Markdown rendering pipeline (highlight, copy, mermaid, katex, TOC)
const MarkdownRenderer = {
  mermaidInitialized: false,

  initMermaid() {
    if (this.mermaidInitialized || typeof mermaid === "undefined") return;
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
      securityLevel: "loose",
    });
    this.mermaidInitialized = true;
  },

  updateMermaidTheme() {
    if (typeof mermaid === "undefined") return;
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
      securityLevel: "loose",
    });
  },

  parse(text) {
    if (!text) return "";
    if (typeof marked === "undefined") return SearchHighlight._escapeHtml(text);
    return marked.parse(text);
  },

  render(container, { text = "", enableToc = false, onToc = null } = {}) {
    if (!container) return { html: "", toc: [] };
    const html = this.parse(text);
    container.innerHTML = html;
    this.enhance(container);
    let toc = [];
    if (enableToc) toc = this.extractToc(container);
    if (onToc) onToc(toc);
    return { html, toc };
  },

  enhance(container) {
    if (!container) return;
    this.highlightCode(container);
    this.addCopyButtons(container);
    this.renderMermaid(container);
    this.renderMath(container);
  },

  highlightCode(container) {
    if (typeof hljs === "undefined") return;
    container.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  },

  addCopyButtons(container) {
    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".code-copy-btn")) return;
      const code = pre.querySelector("code");
      if (!code) return;
      const btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "复制代码");
      btn.innerHTML = '<i data-lucide="copy"></i>';
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          btn.classList.add("copied");
          btn.innerHTML = '<i data-lucide="check"></i>';
          if (typeof lucide !== "undefined") lucide.createIcons();
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML = '<i data-lucide="copy"></i>';
            if (typeof lucide !== "undefined") lucide.createIcons();
          }, 2000);
        } catch (err) {
          Toast.error("复制失败");
        }
      });
      pre.style.position = "relative";
      pre.appendChild(btn);
      if (typeof lucide !== "undefined") lucide.createIcons();
    });
  },

  renderMermaid(container) {
    if (typeof mermaid === "undefined") return;
    this.initMermaid();
    const nodes = container.querySelectorAll("pre code.language-mermaid, pre code.language-mermaid-js");
    nodes.forEach((code) => {
      const pre = code.parentElement;
      const id = "mermaid-" + Math.random().toString(36).slice(2, 9);
      const graphDef = code.textContent;
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-diagram";
      wrapper.textContent = graphDef;
      pre.replaceWith(wrapper);
    });
    try {
      mermaid.run({ querySelector: ".mermaid-diagram" });
    } catch (err) {
      console.warn("Mermaid render failed:", err);
    }
  },

  renderMath(container) {
    if (typeof renderMathInElement === "undefined") return;
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } catch (err) {
      console.warn("KaTeX render failed:", err);
    }
  },

  extractToc(container) {
    const headings = container.querySelectorAll("h1, h2, h3, h4");
    const toc = [];
    headings.forEach((h, idx) => {
      if (!h.id) h.id = "heading-" + idx;
      toc.push({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim(),
        id: h.id,
      });
    });
    return toc;
  },
};

// Skeleton helper
const Skeleton = {
  show(grid, view = "list") {
    const isGrid = view === "grid";
    grid.innerHTML = Array.from(
      { length: isGrid ? 6 : 8 },
      (_, i) => `
      <div class="skeleton-card ${isGrid ? "" : "skeleton-list"}" aria-hidden="true">
        <div class="skeleton-header">
          <div class="skeleton-icon"></div>
          <div class="skeleton-line skeleton-title"></div>
        </div>
        ${isGrid ? '<div class="skeleton-line skeleton-text"></div><div class="skeleton-line skeleton-text-short"></div>' : '<div class="skeleton-line skeleton-text-long"></div>'}
        <div class="skeleton-footer">
          <div class="skeleton-tags">
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
          </div>
          <div class="skeleton-date"></div>
        </div>
      </div>
    `,
    ).join("");
  },

  hide(grid) {
    if (!grid) return;
    const skeletons = grid.querySelectorAll(".skeleton-card");
    skeletons.forEach((el) => el.remove());
  },
};
