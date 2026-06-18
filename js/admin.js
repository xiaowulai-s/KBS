// ====================================
// admin.js - Admin Panel Logic
// ====================================

const ADMIN = {
  // Render admin table
  renderTable() {
    const tbody = document.getElementById('adminTableBody');
    const entries = APP.data.entries;

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:40px;">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(entry => {
      const fileType = FileType.detect(entry.path);
      const icon = FileType.getIcon(fileType);
      return `
        <tr data-id="${entry.id}">
          <td>${entry.id}</td>
          <td><strong>${icon} ${APP.escapeHtml(entry.title)}</strong></td>
          <td>${APP.escapeHtml(entry.category)}</td>
          <td>${entry.tags.map(t => '<span class="card-tag">' + APP.escapeHtml(t) + '</span>').join(' ')}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${APP.escapeHtml(entry.path || '-')}</td>
          <td>${entry.createdAt || '-'}</td>
          <td class="actions">
            <button class="btn btn-primary btn-sm" onclick="ADMIN.editEntry(${entry.id})">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="ADMIN.deleteEntry(${entry.id})">删除</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Edit entry
  editEntry(id) {
    const entry = APP.data.entries.find(e => e.id === id);
    if (!entry) return;
    document.getElementById('adminPanel').style.display = 'none';
    APP.openForm(entry);
  },

  // Delete entry
  async deleteEntry(id) {
    const entry = APP.data.entries.find(e => e.id === id);
    if (!entry) return;
    const confirmed = await ConfirmDialog.show(`确定要删除「${entry.title}」吗？此操作不可撤销。`);
    if (!confirmed) return;

    APP.data.entries = APP.data.entries.filter(e => e.id !== id);
    APP.saveData();
    APP.rebuildMetadata();
    APP.setupSearch();
    APP.renderFilters();
    APP.renderCards();
    APP.updateStats();
    this.renderTable();
    Toast.success('删除成功');
  },

  // Export JSON
  exportJSON() {
    const blob = new Blob([JSON.stringify(APP.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-base-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('导出成功');
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
          Toast.error('无效的 JSON 格式，缺少 entries 数组');
          return;
        }

        const existingIds = new Set(APP.data.entries.map(en => en.id));
        let added = 0, skipped = 0, updated = 0;
        imported.entries.forEach(entry => {
          const existing = APP.data.entries.find(en => en.id === entry.id);
          if (!existing) {
            APP.data.entries.push(entry);
            added++;
          } else {
            Object.keys(entry).forEach(key => { if (entry[key] !== undefined) existing[key] = entry[key]; });
            updated++;
            skipped++;
          }
        });

        APP.rebuildMetadata();
        APP.nextId = Math.max(...APP.data.entries.map(e => e.id), 0) + 1;
        APP.setupSearch();
        APP.saveData();
        APP.renderFilters();
        APP.renderCards();
        APP.updateStats();
        this.renderTable();

        let msg = `成功导入 ${added} 条记录`;
        if (skipped > 0) msg += `，跳过 ${skipped} 条重复`;
        Toast.success(msg);
      } catch (err) {
        Toast.error('JSON 解析失败: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },
};
  // Clean empty categories after deletions
  cleanStaleCategories() {
    APP.categories.clear();
    APP.tags.clear();
    APP.data.entries.forEach(entry => {
      if (entry.category) APP.categories.add(entry.category);
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => { if (tag) APP.tags.add(tag); });
      }
    });
  },

  // Render statistics
  renderStats() {
    const container = document.getElementById('statsContainer');
    if (!container) return;
    var cc = {};
    APP.data.entries.forEach(function(e) { cc[e.category || '未分类'] = (cc[e.category || '未分类'] || 0) + 1; });
    var tf = APP.data.entries.length;
    var tc = Object.keys(cc).length;
    var at = new Set();
    APP.data.entries.forEach(function(e) { if (e.tags) e.tags.forEach(function(t) { at.add(t); }); });
    var tt = at.size;
    var se = APP.data.entries.slice().sort(function(a,b){return(b.createdAt||'').localeCompare(a.createdAt||'');});
    var le = se.length > 0 ? se[0] : null;
    var bh = '';
    Object.keys(cc).forEach(function(cat){
      var pct = tf > 0 ? Math.round((cc[cat]/tf)*100) : 0;
      bh += '<div class="chart-bar"><span class="chart-label">'+cat+'</span><div class="chart-track"><div class="chart-fill" style="width:'+pct+'%"></div></div><span class="chart-value">'+pct+'%</span></div>';
    });
    container.innerHTML =
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-number">'+tf+'</div><div class="stat-label">总文件数</div></div>' +
        '<div class="stat-card"><div class="stat-number">'+tc+'</div><div class="stat-label">分类数</div></div>' +
        '<div class="stat-card"><div class="stat-number">'+tt+'</div><div class="stat-label">标签数</div></div>' +
        '<div class="stat-card"><div class="stat-number">'+(le?le.createdAt:'-')+'</div><div class="stat-label">最新添加</div></div>' +
      '</div>' +
      '<div class="category-chart">' +
        '<h3 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary)">分类分布</h3>' +
        bh + '</div>';
  },
};