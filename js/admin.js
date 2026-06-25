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
    this.renderHistory();

    if (entries.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding:40px;">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = entries
      .map((entry) => {
        const fileType = FileType.detect(entry.path);
        const icon = FileType.getIcon(fileType);
        return `
        <tr data-id="${entry.id}">
          <td class="admin-checkbox"><input type="checkbox" data-id="${entry.id}"></td>
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

    const selectAll = document.getElementById("adminSelectAll");
    if (selectAll) {
      selectAll.checked = false;
      selectAll.addEventListener("change", (e) => {
        tbody.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.checked = e.target.checked;
        });
      });
    }
  },

  // Check file integrity: report entries whose referenced files cannot be fetched
  async checkFileIntegrity() {
    const entries = APP.data.entries || [];
    if (entries.length === 0) {
      Toast.warning("暂无条目可检查");
      return;
    }
    Toast.info("正在检查文件可访问性...");
    const base = window.location.pathname.replace(/\/[^\/]*$/, "/");
    const results = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.path) return { entry, ok: true, skipped: true };
        try {
          const resp = await fetch(base + entry.path, { method: "HEAD", cache: "no-store" });
          return { entry, ok: resp.ok };
        } catch {
          return { entry, ok: false };
        }
      }),
    );
    const broken = results.filter((r) => !r.ok && !r.skipped);
    if (broken.length === 0) {
      Toast.success("所有文件均可正常访问");
      return;
    }
    const list = broken.map((r) => `• ${APP.escapeHtml(r.entry.title)} (${APP.escapeHtml(r.entry.path)})`).join("\n");
    if (ConfirmDialog.show) {
      ConfirmDialog.show({
        title: "发现失效链接",
        message: `共 ${broken.length} 个条目引用的文件无法访问：\n\n${list}\n\n请检查 docs/ 目录或修正文件路径。`,
        confirmText: "知道了",
        showCancel: false,
      });
    } else {
      alert(`发现 ${broken.length} 个失效链接，请检查控制台。`);
    }
  },

  // Render stats dashboard: overview, category distribution, hot tags, file types, recent activity
  renderStatsDashboard(entries) {
    const container = document.getElementById("statsContainer");
    if (!container) return;

    const catCounts = {};
    const tagCounts = {};
    const typeCounts = {};
    entries.forEach((e) => {
      const cat = e.category || "未分类";
      catCounts[cat] = (catCounts[cat] || 0) + 1;

      (e.tags || []).forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });

      const ft = FileType.detect(e.path);
      typeCounts[ft] = (typeCounts[ft] || 0) + 1;
    });

    const totalEntries = entries.length;
    const totalCategories = Object.keys(catCounts).length;
    const totalTags = Object.keys(tagCounts).length;
    const favCount = APP.favorites ? APP.favorites.size : 0;

    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const maxCatCount = sortedCats.length ? sortedCats[0][1] : 1;
    const catBars = sortedCats
      .slice(0, 12)
      .map(([cat, count]) => {
        const pct = ((count / maxCatCount) * 100).toFixed(0);
        return `<div class="chart-bar" data-cat="${APP.escapeHtml(cat)}" role="button" tabindex="0">
          <span class="chart-label">${APP.escapeHtml(cat)}</span>
          <div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div>
          <span class="chart-value">${count}</span>
        </div>`;
      })
      .join("");

    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const maxTagCount = sortedTags.length ? sortedTags[0][1] : 1;
    const hotTags = sortedTags
      .slice(0, 24)
      .map(([tag, count]) => {
        const weight = count / maxTagCount;
        const size = weight >= 0.8 ? "lg" : weight >= 0.5 ? "md" : weight >= 0.25 ? "sm" : "xs";
        return `<span class="tag-cloud-item tag-size-${size}" data-tag="${APP.escapeHtml(tag)}">#${APP.escapeHtml(tag)} <small>${count}</small></span>`;
      })
      .join("");

    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const typeIcons = {
      markdown: "file-text",
      image: "image",
      pdf: "file-text",
      video: "video",
      audio: "music",
      other: "file",
    };
    const typeList = sortedTypes
      .map(([type, count]) => {
        const icon = typeIcons[type] || "file";
        return `<div class="type-pill" data-type="${APP.escapeHtml(type)}">
          <i data-lucide="${icon}"></i>
          <span>${APP.escapeHtml(type)}</span>
          <span class="type-count">${count}</span>
        </div>`;
      })
      .join("");

    const recentEntries = [...entries]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 10)
      .map((e) => {
        const date = (e.createdAt || "").slice(0, 10) || "-";
        return `<div class="activity-item" data-id="${e.id}">
          <div class="activity-dot"></div>
          <div class="activity-main">
            <span class="activity-title">${APP.escapeHtml(e.title)}</span>
            <span class="activity-meta">${APP.escapeHtml(e.category)} · ${date}</span>
          </div>
        </div>`;
      })
      .join("");

    container.innerHTML = `
      <div class="stats-overview">
        <div class="stat-card stat-card-primary">
          <div class="stat-number">${totalEntries}</div>
          <div class="stat-label">总条目</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalCategories}</div>
          <div class="stat-label">分类</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalTags}</div>
          <div class="stat-label">标签</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${favCount}</div>
          <div class="stat-label">收藏</div>
        </div>
      </div>
      <div class="stats-charts">
        <div class="stats-panel category-chart">
          <h3 class="stats-panel-title"><i data-lucide="folder-tree"></i> 分类分布</h3>
          ${catBars || '<div class="stats-empty">暂无分类数据</div>'}
        </div>
        <div class="stats-panel tag-cloud">
          <h3 class="stats-panel-title"><i data-lucide="tags"></i> 热门标签</h3>
          ${hotTags || '<div class="stats-empty">暂无标签数据</div>'}
        </div>
      </div>
      <div class="stats-charts">
        <div class="stats-panel type-chart">
          <h3 class="stats-panel-title"><i data-lucide="file-type"></i> 文件类型</h3>
          <div class="type-list">${typeList || '<div class="stats-empty">暂无文件类型数据</div>'}</div>
        </div>
        <div class="stats-panel activity-chart">
          <h3 class="stats-panel-title"><i data-lucide="clock"></i> 最近活动</h3>
          ${recentEntries || '<div class="stats-empty">暂无活动记录</div>'}
        </div>
      </div>
    `;

    container.querySelectorAll(".chart-bar[data-cat]").forEach((el) => {
      el.addEventListener("click", () => {
        APP.activeCategory = el.dataset.cat;
        APP.activeTag = null;
        APP.searchQuery = "";
        document.getElementById("adminPanel").style.display = "none";
        APP.renderSidebar();
        APP.renderList();
        APP.renderFilterChips();
        APP.updateStatus();
      });
    });

    container.querySelectorAll(".tag-cloud-item[data-tag]").forEach((el) => {
      el.addEventListener("click", () => {
        APP.activeTag = el.dataset.tag;
        APP.activeCategory = null;
        APP.searchQuery = "";
        document.getElementById("adminPanel").style.display = "none";
        APP.renderSidebar();
        APP.renderList();
        APP.renderFilterChips();
        APP.updateStatus();
      });
    });

    container.querySelectorAll(".activity-item[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = parseInt(el.dataset.id);
        document.getElementById("adminPanel").style.display = "none";
        APP.selectEntry(id);
      });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  // Render recent operation history
  renderHistory() {
    const container = document.getElementById("adminHistory");
    if (!container) return;
    const items = History.getHistory().slice(0, 20);
    if (items.length === 0) {
      container.innerHTML = "";
      return;
    }
    const list = items
      .map(
        (h) => `
        <div class="admin-history-item">
          <div>
            <span class="admin-history-action">${APP.escapeHtml(h.action)}</span>
            <span class="admin-history-detail">${APP.escapeHtml(h.detail)}</span>
          </div>
          <span class="admin-history-time">${History.formatTime(h.time)}</span>
        </div>`,
      )
      .join("");
    container.innerHTML = `
      <div class="admin-history-title">
        <span>最近操作</span>
        <button class="btn btn-ghost btn-sm" id="clearHistoryBtn">清空</button>
      </div>
      <div class="admin-history-list">${list}</div>
    `;
    const clearBtn = document.getElementById("clearHistoryBtn");
    if (clearBtn)
      clearBtn.addEventListener("click", () => {
        History.clear();
        this.renderHistory();
      });
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
    APP.renderList();
    APP.renderSidebar();
    APP.renderDetail();
    APP.updateStatus();
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
    History.log("导出数据", "JSON");
  },

  // Import JSON (single or multiple files)
  async importJSON(event) {
    const files = event.target.files ? [...event.target.files] : [];
    if (files.length === 0) return;
    await this.importJSONFiles(files);
  },

  async importJSONFiles(files) {
    const existingIds = new Set(APP.data.entries.map((en) => en.id));
    let totalAdded = 0, totalSkipped = 0, totalFailed = 0, fileCount = 0;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".json")) continue;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!imported.entries || !Array.isArray(imported.entries)) {
          Toast.warning(`${file.name} 缺少 entries 数组，已跳过`);
          continue;
        }
        fileCount++;

        let added = 0, skipped = 0, failed = 0;
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
              existingIds.add(created.id);
              added++;
            } catch (err) {
              failed++;
              console.error("API create failed:", err);
            }
          } else {
            APP.data.entries.push(entry);
            existingIds.add(entry.id);
            added++;
          }
        }
        totalAdded += added;
        totalSkipped += skipped;
        totalFailed += failed;
      } catch (err) {
        Toast.error(`${file.name} 解析失败: ${err.message}`);
      }
    }

    if (fileCount === 0) {
      Toast.warning("未找到有效的 JSON 文件");
      return;
    }

    APP.rebuildMetadata();
    APP.nextId = Math.max(...APP.data.entries.map((e) => e.id), 0) + 1;
    APP.setupSearch();
    APP.saveData();
    APP.renderList();
    APP.renderSidebar();
    APP.renderDetail();
    APP.updateStatus();
    this.renderTable();

    let msg = `成功导入 ${totalAdded} 条记录`;
    if (totalSkipped > 0) msg += `，跳过 ${totalSkipped} 条重复`;
    if (totalFailed > 0) msg += `，失败 ${totalFailed} 条`;
    Toast.success(msg);
    History.log("导入数据", `JSON ${totalAdded} 条`);
  },

  setupDropZone() {
    const zone = document.getElementById("adminDropZone");
    const input = document.getElementById("adminDropInput");
    if (!zone || !input) return;

    zone.addEventListener("click", () => input.click());

    ["dragenter", "dragover"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("drag-over");
      });
    });

    zone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files ? [...e.dataTransfer.files] : [];
      if (files.length) this.importJSONFiles(files);
    });

    input.addEventListener("change", (e) => this.importJSON(e));
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
      History.log("部署到 GitHub", result.message || "成功");
    } catch (err) {
      Toast.error("部署失败: " + err.message);
    }
  },

  // Import / Export modal
  openIoModal(section) {
    const modal = document.getElementById("ioModal");
    if (modal) modal.style.display = "flex";
  },

  closeIoModal() {
    const modal = document.getElementById("ioModal");
    if (modal) modal.style.display = "none";
  },

  toCsvField(val) {
    const s = val == null ? "" : String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  },

  exportCSV() {
    const headers = ["id", "title", "category", "tags", "path", "description", "createdAt", "type"];
    const rows = APP.data.entries.map((e) =>
      [
        e.id,
        this.toCsvField(e.title),
        this.toCsvField(e.category),
        this.toCsvField((e.tags || []).join(";")),
        this.toCsvField(e.path),
        this.toCsvField(e.description),
        this.toCsvField(e.createdAt),
        this.toCsvField(e.type),
      ].join(","),
    );
    const csv = "\ufeff" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-base-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    History.log("导出数据", "CSV");
    Toast.success("CSV 导出成功");
    this.closeIoModal();
  },

  parseCSV(text) {
    const lines = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(cell);
          cell = "";
        } else if (ch === "\n") {
          row.push(cell);
          lines.push(row);
          row = [];
          cell = "";
        } else if (ch !== "\r") {
          cell += ch;
        }
      }
    }
    if (cell || row.length > 0) {
      row.push(cell);
      lines.push(row);
    }
    return lines;
  },

  async importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = this.parseCSV(text);
    if (lines.length < 2) {
      Toast.error("CSV 文件没有数据");
      return;
    }
    const headers = lines[0].map((h) => h.trim().toLowerCase());
    const required = ["title", "category"];
    if (!required.every((r) => headers.includes(r))) {
      Toast.error("CSV 缺少必要列 title/category");
      return;
    }
    const get = (row, name) => row[headers.indexOf(name)] || "";
    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length < 2) continue;
      const title = get(row, "title").trim();
      const category = get(row, "category").trim();
      if (!title || !category) continue;
      const tags = get(row, "tags")
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const entry = {
        title,
        category,
        tags,
        path: get(row, "path").trim(),
        description: get(row, "description").trim(),
        createdAt: get(row, "createdAt").trim() || new Date().toISOString().slice(0, 10),
        type: get(row, "type").trim() || FileType.detect(get(row, "path").trim()),
      };
      if (APP.apiMode) {
        try {
          const created = await API.createEntry(entry);
          APP.data.entries.push(created);
          added++;
        } catch (err) {
          console.error("CSV import API failed:", err);
        }
      } else {
        entry.id = APP.nextId++;
        APP.data.entries.push(entry);
        added++;
      }
    }
    APP.rebuildMetadata();
    APP.setupSearch();
    APP.saveData();
    APP.renderList();
    APP.renderSidebar();
    APP.renderDetail();
    APP.updateStatus();
    this.renderTable();
    History.log("导入数据", `CSV ${added} 条`);
    Toast.success(`CSV 导入成功，新增 ${added} 条`);
    event.target.value = "";
    this.closeIoModal();
  },

  async exportMdPackage() {
    if (typeof JSZip === "undefined") {
      Toast.error("JSZip 未加载");
      return;
    }
    const zip = new JSZip();
    APP.data.entries.forEach((e) => {
      const fm = [
        "---",
        `id: ${e.id}`,
        `title: ${e.title}`,
        `category: ${e.category}`,
        `tags: ${(e.tags || []).join(", ")}`,
        `path: ${e.path || ""}`,
        `createdAt: ${e.createdAt || ""}`,
        `type: ${e.type || FileType.detect(e.path || "")}`,
        "---",
        "",
        e.description || "",
      ].join("\n");
      const safeName = (e.title || `entry-${e.id}`).replace(/[\\/:*?"<>|]/g, "_");
      zip.file(`${safeName}.md`, fm);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `knowledge-base-md-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    History.log("导出数据", "Markdown 包");
    Toast.success("Markdown 包导出成功");
    this.closeIoModal();
  },

  async importMdFolder(event) {
    const files = Array.from(event.target.files || []);
    const mdFiles = files.filter((f) => f.name.toLowerCase().endsWith(".md"));
    if (mdFiles.length === 0) {
      Toast.error("未选择 Markdown 文件");
      return;
    }
    let added = 0;
    for (const file of mdFiles) {
      const text = await file.text();
      const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (!match) continue;
      const fm = match[1];
      const body = match[2].trim();
      const get = (key) => {
        const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
        return m ? m[1].trim() : "";
      };
      const title = get("title") || file.name.replace(/\.md$/i, "");
      const category = get("category") || "未分类";
      const tags = get("tags")
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const path = get("path");
      const createdAt = get("createdAt") || new Date().toISOString().slice(0, 10);
      const entry = {
        title,
        category,
        tags,
        path,
        description: body,
        createdAt,
        type: get("type") || FileType.detect(path),
      };
      if (APP.apiMode) {
        try {
          const created = await API.createEntry(entry);
          APP.data.entries.push(created);
          added++;
        } catch (err) {
          console.error("MD import API failed:", err);
        }
      } else {
        entry.id = APP.nextId++;
        APP.data.entries.push(entry);
        added++;
      }
    }
    APP.rebuildMetadata();
    APP.setupSearch();
    APP.saveData();
    APP.nextId = Math.max(...APP.data.entries.map((e) => e.id), 0) + 1;
    APP.renderList();
    APP.renderSidebar();
    APP.renderDetail();
    APP.updateStatus();
    this.renderTable();
    History.log("导入数据", `Markdown ${added} 条`);
    Toast.success(`Markdown 导入成功，新增 ${added} 条`);
    event.target.value = "";
    this.closeIoModal();
  },
};
