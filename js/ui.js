const UI = {
  app: null,
  RECENT_KEY: "kb_recent",
  SIDEBAR_COLLAPSED_KEY: "kb_sidebar_collapsed",

  init(app) {
    this.app = app;
    this.initSidebar();
    this.initMobileTab();
    this.initResizeHandler();
    this.initOverlayClick();
  },

  // ─── Sidebar ───

  initSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const collapsed = localStorage.getItem(this.SIDEBAR_COLLAPSED_KEY) === "true";
    if (collapsed && window.innerWidth > 1279) {
      sidebar.classList.add("collapsed");
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const layout = document.getElementById("layout");
    if (!sidebar) return;

    if (window.innerWidth <= 1024) {
      const isOpen = sidebar.classList.contains("open");
      sidebar.classList.toggle("open", !isOpen);
      layout?.classList.toggle("overlay", !isOpen);
    } else {
      const isCollapsed = sidebar.classList.contains("collapsed");
      sidebar.classList.toggle("collapsed", !isCollapsed);
      localStorage.setItem(this.SIDEBAR_COLLAPSED_KEY, !isCollapsed);
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const layout = document.getElementById("layout");
    sidebar?.classList.remove("open");
    layout?.classList.remove("overlay");
  },

  // ─── Detail Panel ───

  openDetailPanel() {
    if (window.innerWidth <= 1024) {
      const detail = document.getElementById("detailColumn");
      const layout = document.getElementById("layout");
      detail?.classList.add("open");
      layout?.classList.add("overlay");
    }
  },

  closeDetailPanel() {
    const detail = document.getElementById("detailColumn");
    const layout = document.getElementById("layout");
    detail?.classList.remove("open");
    if (!document.getElementById("sidebar")?.classList.contains("open")) {
      layout?.classList.remove("overlay");
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
    if (window.innerWidth <= 768) {
      this.showMobileTab("list");
    }
  },

  showMobileTab(tab) {
    document.querySelectorAll(".mobile-tab-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });

    const listColumn = document.querySelector(".list-column");
    const detailColumn = document.querySelector(".detail-column");
    const sidebar = document.getElementById("sidebar");

    this.closeSidebar();
    this.closeDetailPanel();

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

  // ─── Overlay Click ───

  initOverlayClick() {
    const layout = document.getElementById("layout");
    if (!layout) return;
    layout.addEventListener("click", (e) => {
      if (e.target === layout && layout.classList.contains("overlay")) {
        this.closeSidebar();
        this.closeDetailPanel();
      }
    });
  },

  // ─── Admin Panel ───

  toggleAdminPanel() {
    const p = document.getElementById("adminPanel");
    if (!p) return;
    const isHidden = p.style.display === "none" || !p.style.display;
    p.style.display = isHidden ? "flex" : "none";
    if (isHidden && typeof ADMIN !== "undefined") ADMIN.renderTable();
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
      if (window.innerWidth > 1024) {
        this.closeSidebar();
        this.closeDetailPanel();
      }
      if (window.innerWidth > 768) {
        document.querySelector(".list-column")?.classList.add("active");
        document.querySelector(".detail-column")?.classList.remove("active");
      }
    });
  },
};
