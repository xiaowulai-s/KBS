const UI = {
  app: null,
  RECENT_KEY: "kb_recent",
  SIDEBAR_COLLAPSED_KEY: "kb_sidebar_collapsed",

  init(app) {
    this.app = app;
    this.initSidebar();
    this.initMobileTab();
    this.initResizeHandler();
  },

  // ─── Sidebar ───

  initSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const collapsed = localStorage.getItem(this.SIDEBAR_COLLAPSED_KEY) === "true";
    if (collapsed) sidebar.classList.add("collapsed");
  },

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const isHidden = sidebar.classList.contains("hidden");
    const isCollapsed = sidebar.classList.contains("collapsed");

    if (window.innerWidth <= 1024) {
      sidebar.classList.toggle("hidden", !isHidden);
    } else {
      sidebar.classList.toggle("collapsed", !isCollapsed);
      localStorage.setItem(this.SIDEBAR_COLLAPSED_KEY, !isCollapsed);
    }
  },

  // ─── Mobile Tab ───

  initMobileTab() {
    const tabs = document.querySelectorAll(".mobile-tab-item");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.showMobileTab(tab.dataset.tab);
      });
    });
  },

  showMobileTab(tab) {
    document.querySelectorAll(".mobile-tab-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });

    const listColumn = document.querySelector(".list-column");
    const detailColumn = document.querySelector(".detail-column");
    const sidebar = document.getElementById("sidebar");

    if (tab === "list") {
      listColumn?.classList.add("active");
      detailColumn?.classList.remove("active");
      sidebar?.classList.add("hidden");
      this.app.currentSidebarView = "all";
      this.app.showFavoritesOnly = false;
      this.app.activeCategory = null;
      this.app.activeTag = null;
      this.app.searchQuery = "";
      this.app.renderSidebar();
      this.app.renderList();
      this.app.renderFilterChips();
      this.app.updateStatus();
    } else if (tab === "detail") {
      listColumn?.classList.remove("active");
      detailColumn?.classList.add("active");
      sidebar?.classList.add("hidden");
    } else if (tab === "mine") {
      listColumn?.classList.add("active");
      detailColumn?.classList.remove("active");
      sidebar?.classList.remove("hidden");
      this.app.currentSidebarView = "favorites";
      this.app.showFavoritesOnly = true;
      this.app.activeCategory = null;
      this.app.activeTag = null;
      this.app.searchQuery = "";
      this.app.renderSidebar();
      this.app.renderList();
      this.app.renderFilterChips();
      this.app.updateStatus();
    }
  },

  // ─── Admin Panel ───

  toggleAdminPanel() {
    const p = document.getElementById("adminPanel");
    if (!p) return;
    const isHidden = p.style.display === "none" || !p.style.display;
    p.style.display = isHidden ? "block" : "none";
    if (isHidden) ADMIN.renderTable();
  },

  closeAdminPanel() {
    const p = document.getElementById("adminPanel");
    if (p) p.style.display = "none";
  },

  // ─── Recent ───

  getRecentIds() {
    try {
      return JSON.parse(localStorage.getItem(this.RECENT_KEY)) || [];
    } catch {
      return [];
    }
  },

  addRecentId(id) {
    let ids = this.getRecentIds();
    ids = ids.filter((x) => x !== id);
    ids.unshift(id);
    ids = ids.slice(0, 20);
    localStorage.setItem(this.RECENT_KEY, JSON.stringify(ids));
  },

  // ─── Resize ───

  initResizeHandler() {
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        document.querySelector(".list-column")?.classList.add("active");
        document.querySelector(".detail-column")?.classList.remove("active");
      }
    });
  },
};
