# KBS · 本地文件知识库

[![Version](https://img.shields.io/badge/version-1.0.0-00d4aa)](https://github.com/xiaowulai-s/KBS/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=github)](https://xiaowulai-s.github.io/KBS)

一个基于 GitHub Pages 部署的静态 PWA 应用，用于将本地文件整理成结构化的在线知识库。支持本地后端服务持久化、批量管理、回收站、全文搜索、Markdown 在线编辑和知识图谱可视化。

**当前版本：v1.0.0**

## 功能特性

### 核心能力
- **知识库展示** - 列表/网格双视图，Industrial Editorial 深色/浅色主题，三档密度调节
- **全文搜索** - 基于 MiniSearch 的前端全文检索，支持标题、描述、标签、分类、正文内容搜索
- **分类与标签** - 树形分类、标签云、筛选面包屑，支持标签/分类重命名、合并、删除、清理未使用
- **Markdown 预览与编辑** - 点击卡片预览 Markdown，内置实时预览编辑器，支持目录导航
- **多媒体预览** - 图片灯箱、PDF/视频/音频内嵌预览
- **附件上传** - 拖拽上传文件到 `docs/` 目录（需启动本地后端服务）

### 阅读增强
- **文档目录 (TOC)** - 自动提取 Markdown 标题，右侧目录快速跳转
- **代码高亮** - 基于 highlight.js 的语法高亮与一键复制
- **Mermaid 图表** - 渲染流程图、时序图等 Mermaid 图表
- **KaTeX 公式** - 支持行内与块级数学公式
- **阅读进度** - 自动记录滚动位置，下次打开时恢复，顶部进度条 + 浮动百分比
- **相关文章推荐** - 基于分类、标签、标题关键词相似度的加权推荐

### 发现与组织
- **时间轴视图** - 按创建时间（YYYY-MM）分组展示
- **专题聚合** - 按分类聚合条目，展示热门标签与最近更新
- **知识图谱** - D3.js 力导向图可视化条目-分类-标签关系，支持拖拽、缩放、点击筛选
- **高级筛选器** - 按文件类型、日期范围筛选，条件以 Chip 形式展示
- **命令面板** - `/` 快速搜索，支持搜索历史、热门标签、最近更新建议

### 管理增强
- **管理面板** - 增删改查索引条目、分类统计仪表盘、操作历史
- **批量操作** - 批量移动分类、打标签、收藏、删除、恢复
- **回收站** - 软删除、恢复、永久删除，30 天后自动清理
- **数据导入导出** - 支持 JSON（多文件拖拽批量导入）、CSV、Markdown 压缩包
- **文件完整性检查** - 一键扫描并报告失效的文件链接
- **本地后端持久化** - FastAPI 服务直接读写 `data/index.json`，解决前端修改无法落地的问题

### 体验优化
- **命令面板** - ` / ` 快速搜索与命令跳转
- **Vim 式快捷键** - `j`/`k` 导航、`Enter` 打开、`x` 删除、`b` 批量模式
- **收藏与最近阅读** - 快速访问常用条目
- **URL 状态同步** - 搜索、筛选、选中状态同步到 URL 参数
- **PWA 支持** - Service Worker 离线缓存，可添加到主屏幕
- **RSS Feed** - 知识库订阅支持

## 快速开始

### 1. 准备文件

将文档放入 `docs/` 目录，支持 Markdown、PDF、图片、视频、音频等多种格式。

### 2. 生成索引

```bash
python scripts/generate_index.py
```

### 3. 本地预览（推荐）

必须通过 HTTP 服务访问，直接双击 `index.html` 会导致文件预览失败。

```bash
# 方式一：Python 内置服务器
python -m http.server 8080

# 方式二：本地后端服务（支持数据持久化和自动推送）
cd server
python start.py
```

浏览器访问 http://localhost:8080 或 http://localhost:5000。

### 4. 部署到 GitHub Pages

推送代码到 GitHub 仓库的 `main` 分支，GitHub Actions 自动部署到 Pages：

```bash
git add .
git commit -m "update knowledge base"
git push origin main
```

访问 `https://<username>.github.io/<repo>`。

## 手动添加条目

在 `data/index.json` 的 `entries` 数组中添加对象：

```json
{
  "id": 6,
  "title": "我的文档",
  "category": "学习笔记",
  "tags": ["笔记1", "笔记2"],
  "path": "docs/myfile.md",
  "description": "文档描述",
  "createdAt": "2026-06-17",
  "type": "markdown"
}
```

也可通过管理面板的「新增条目」表单或本地后端 API 添加。

## 项目结构

```
├── index.html              # SPA 入口
├── 404.html                # 自定义 404 页面
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker（离线缓存）
├── feed.xml                # RSS Feed
├── CNAME                   # 自定义域名
├── css/
│   └── style.css           # 全局样式
├── js/
│   ├── app.js              # 主应用逻辑（SPA 控制器）
│   ├── admin.js            # 管理面板 CRUD、导入导出
│   ├── api.js              # 本地后端 API 客户端
│   ├── ui.js               # UI 交互与响应式布局
│   └── utils.js            # 工具库（Toast、分页、搜索高亮、历史等）
├── data/
│   └── index.json          # 知识库索引数据库
├── docs/                   # 文档存放区
├── server/                 # 本地后端服务（FastAPI）
│   ├── main.py             # API 入口
│   ├── start.py            # 启动脚本
│   └── requirements.txt    # Python 依赖
├── scripts/
│   ├── generate_index.py   # 自动扫描 docs/ 生成索引
│   ├── watch_docs.py       # 监听文件变化自动更新索引并可选推送 GitHub
│   ├── git_pusher.py       # Git 自动提交与推送模块
│   └── config.json         # 监控脚本配置（自动推送开关等）
├── assets/
│   └── images/             # PWA 图标资源
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages CI/CD
└── .gitignore
```

## 技术栈

- **前端** - 原生 JavaScript (ES2020+), HTML5, CSS3, Tailwind-like 自定义属性
- **搜索** - MiniSearch 7.x（客户端全文检索引擎）
- **Markdown** - marked.js 15.x（渲染引擎）
- **图标** - Lucide Icons
- **PWA** - Service Worker + Web App Manifest
- **后端** - Python 3 + FastAPI
- **部署** - GitHub Pages + GitHub Actions

## 本地开发

### 启动本地后端服务

```bash
cd server
pip install -r requirements.txt
python start.py
```

服务启动后访问 http://localhost:5000，此时前端修改会通过 API 直接写入 `data/index.json`，并可通过管理面板一键推送到 GitHub Pages。

### Python 工具脚本

```bash
# 生成索引
python scripts/generate_index.py

# 监听 docs/ 目录变化（自动重新生成索引）
python scripts/watch_docs.py

# 监听并自动推送到 GitHub Pages
# 1. 编辑 scripts/config.json，将 autoPush.enabled 设为 true
# 2. 确保已配置 Git 推送凭证（SSH Key 或 Git Credential Manager）
python scripts/watch_docs.py
```

### 数据持久化说明

| 模式 | 数据源 | 持久化方式 |
|---|---|---|
| 静态模式 | `data/index.json` | 修改保存到浏览器 `localStorage`，需手动导出/导入 |
| 本地后端模式 | `data/index.json` | 修改直接写入文件，可一键推送 GitHub |

## 重要提示

**请勿直接通过 `file://` 协议打开 `index.html`**，否则浏览器安全策略会阻止文件预览和附件下载。请通过本地服务器或 GitHub Pages 访问。

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `/` | 打开命令面板 |
| `j` / `k` | 下/上导航 |
| `Enter` | 打开选中条目 |
| `x` | 删除选中条目 |
| `r` | 恢复回收站条目 |
| `b` | 切换批量模式 |
| `Space` | 批量模式下切换选中 |
| `Esc` | 关闭面板/弹窗 |

## License

MIT
