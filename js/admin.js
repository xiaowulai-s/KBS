// ====================================
// admin.js - Admin Panel Logic
// ====================================

const ADMIN = {
  // Render admin table with stats dashboard
  renderTable() {
    const tbody = document.getElementById("adminTableBody");
    if (!tbody) return;
    const entries = APP.data.entries;

    // Render stats dashboard
    this.renderStatsDashboard(entries);

    if (entries.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:40px;">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = entries
      .map((entry) => {
        const fileType = FileType.detect(entry.path);
        const icon = FileType.getIcon(fileType);
        return `
        <tr data-id="${entry.id}">
          <td>${entry.id}</td>
          <td><strong>${icon} ${APP.escapeHtml(entry.title)}</strong></td>
          <td>${APP.escapeHtml(entry.category)}</td>
          <td>${entry.tags.map((t) => '<span class="card-tag">' + APP.escapeHtml(t) + "</span>").join(" ")}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${APP.escapeHtml(entry.path || "-")}</td>
          <td>${entry.createdAt || "-"}</td>
          <td class="actions">
            <button class="btn btn-primary btn-sm" onclick="ADMIN.editEntry(${entry.id})">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="ADMIN.deleteEntry(${entry.id})">删除</button>
          </td>
        </tr>
      `;
      })
      .join("");
  },

  // Render stats dashboard with category distribution
  renderStatsDashboard(entries) {
    const container = document.getElementById("statsContainer");
    if (!container) return;

    // Compute category distribution
    const catCounts = {};
    const typeCounts = {};
    entries.forEach((e) => {
      const cat = e.category || "未分类";
      catCounts[cat] = (catCounts[cat] || 0) + 1;

      const type = e.type || "other";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const maxCatCount = Math.max(...Object.values(catCounts), 1);
    const catBars = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => {
        const pct = (count / maxCatCount * 100).toFixed(0);
        return `<div class="chart-bar">
          <span class="chart-label">${APP.escapeHtml(cat)}</span>
          <div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div>
          <span class="chart-value">${count}</span>
        </div>`;
      }).join("");

    const totalEntries = entries.length;
    const totalCategories = Object.keys(catCounts).length;
    const totalTypes = Object.keys(typeCounts).length;
    const favCount = APP.favorites ? APP.favorites.size : 0;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${totalEntries}</div>
          <div class="stat-label">总条目</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalCategories}</div>
          <div class="stat-label">分类数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalTypes}</div>
          <div class="stat-label">文件类型</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${favCount}</div>
          <div class="stat-label">收藏数</div>
        </div>
      </div>
      <div class="category-chart">
        <h3 style="margin-bottom:12px;font-size:14px;color:var(--text-secondary);">分类分布</h3>
        ${catBars}
      </div>
    `;
  },

  // Edit entry
  editEntry(id) {
    const entry = APP.data.entries.find((e) => e.id === id);
    if (!entry) return;
    document.getElementById("adminPanel").style.display = "none";
    APP.openForm(entry);
  },

  // Delete entry
  async deleteEntry(id) {
    const entry = APP.data.entries.find((e) => e.id === id);
    if (!entry) return;
    const confirmed = await ConfirmDialog.show(
      `确定要删除「${entry.title}」吗？此操作不可撤销。`,
    );
    if (!confirmed) return;

    if (APP.apiMode) {
      try {
        await API.deleteEntry(id);
      } catch (err) {
        Toast.error("删除失败: " + err.message);
        return;
      }
    }

    APP.data.entries = APP.data.entries.filter((e) => e.id !== id);
    APP.saveData();
    APP.rebuildMetadata();
    APP.setupSearch();
    APP.renderSidebar();
    APP.renderCards();
    APP.updateStats();
    this.renderTable();
    Toast.success("删除成功");
  },

  // Export JSON
  exportJSON() {
    const blob = new Blob([JSON.stringify(APP.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-base-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success("导出成功");
  },

  // Import JSON
  async importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.entries || !Array.isArray(imported.entries)) {
          Toast.error("无效的 JSON 格式，缺少 entries 数组");
          return;
        }

        const existingIds = new Set(APP.data.entries.map((en) => en.id));
        let added = 0,
          skipped = 0,
          failed = 0;

        for (const entry of imported.entries) {
          if (existingIds.has(entry.id)) {
            skipped++;
            continue;
          }
          if (APP.apiMode) {
            try {
              const created = await API.createEntry({
                title: entry.title || "未命名",
                category: entry.category || "未分类",
                tags: entry.tags || [],
                path: entry.path || "",
                description: entry.description || "",
                createdAt: entry.createdAt || new Date().toISOString().slice(0, 10),
                type: entry.type || FileType.detect(entry.path || ""),
              });
              APP.data.entries.push(created);
              added++;
            } catch (err) {
              failed++;
              console.error("API create failed:", err);
            }
          } else {
            APP.data.entries.push(entry);
            added++;
          }
        }

        APP.rebuildMetadata();
        APP.nextId = Math.max(...APP.data.entries.map((e) => e.id), 0) + 1;
        APP.setupSearch();
        APP.saveData();
        APP.renderSidebar();
        APP.renderCards();
        APP.updateStats();
        this.renderTable();

        let msg = `成功导入 ${added} 条记录`;
        if (skipped > 0) msg += `，跳过 ${skipped} 条重复`;
        if (failed > 0) msg += `，失败 ${failed} 条`;
        Toast.success(msg);
      } catch (err) {
        Toast.error("JSON 解析失败: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  },

  // Deploy to GitHub Pages
  async deployToGitHub() {
    if (!APP.apiMode) {
      Toast.warning("本地后端服务未启动，无法部署");
      return;
    }
    const confirmed = await ConfirmDialog.show(
      "确定将当前数据提交并推送到 GitHub Pages 吗？",
    );
    if (!confirmed) return;
    Toast.info("正在部署，请稍候...");
    try {
      const result = await API.deploy();
      Toast.success(result.message || "部署成功");
    } catch (err) {
      Toast.error("部署失败: " + err.message);
    }
  },
};
