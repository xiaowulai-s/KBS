// ====================================
// admin.js - Admin Panel Logic
// ====================================

const ADMIN = {
  // Render admin table
  renderTable() {
    const tbody = document.getElementById("adminTableBody");
    if (!tbody) return;
    const entries = APP.data.entries;

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
  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.entries || !Array.isArray(imported.entries)) {
          Toast.error("无效的 JSON 格式，缺少 entries 数组");
          return;
        }

        const existingIds = new Set(APP.data.entries.map((en) => en.id));
        let added = 0,
          skipped = 0;
        imported.entries.forEach((entry) => {
          if (!existingIds.has(entry.id)) {
            APP.data.entries.push(entry);
            added++;
          } else {
            skipped++;
          }
        });

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
        Toast.success(msg);
      } catch (err) {
        Toast.error("JSON 解析失败: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  },
};
