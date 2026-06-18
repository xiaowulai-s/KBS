# 本地文件知识库

一个基于 GitHub Pages 部署的静态 PWA 应用，用于将本地文件整理成结构化的在线知识库。

## 功能特性

- **知识库展示** - 卡片式网格布局，美观直观
- **全文搜索** - 基于 MiniSearch 的前端全文检索
- **分类筛选** - 按分类和标签过滤文件
- **Markdown 预览** - 点击卡片即可预览 Markdown 文件内容（使用 marked.js）
- **管理面板** - 增删改查索引条目，分类统计仪表盘
- **JSON 导入导出** - 备份和恢复数据
- **响应式设计** - 完美适配桌面和移动设备
- **PWA 支持** - 离线缓存，可添加到主屏幕
- **收藏功能** - 标记常用条目
- **搜索历史** - 自动记录最近 10 次搜索
- **URL 状态同步** - 搜索和筛选条件同步到 URL 参数
- **键盘快捷键** - 提升操作效率
- **主题切换** - 明暗主题切换
- **批量操作** - 批量删除条目
- **RSS Feed** - 知识库订阅支持

## 快速开始

1. 克隆或下载本项目
2. 将文档放入 `docs/` 目录
3. 运行 `python scripts/generate_index.py` 自动生成索引
4. 将文件推送到 GitHub 仓库（自动触发 CI/CD 部署）
5. 访问 `https://<username>.github.io/<repo>`

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

也可通过管理面板的"新增条目"表单直接添加。

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
│   ├── admin.js            # 管理面板 CRUD
│   └── utils.js            # 工具库（Toast、分页、搜索高亮等）
├── data/
│   └── index.json          # 知识库索引数据库
├── docs/                   # 文档存放区
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

- **前端** - 原生 JavaScript (ES2020+), HTML5, CSS3
- **搜索** - MiniSearch 7.x（客户端全文检索引擎）
- **Markdown** - marked.js 15.x（渲染引擎）
- **PWA** - Service Worker + Web App Manifest
- **工具脚本** - Python 3
- **部署** - GitHub Pages + GitHub Actions

## 本地开发

### Python 工具

```bash
# 生成索引
python scripts/generate_index.py

# 监听 docs/ 目录变化（自动重新生成索引）
python scripts/watch_docs.py

# 监听 docs/ 目录变化并自动推送到 GitHub Pages
# 1. 编辑 scripts/config.json，将 autoPush.enabled 设为 true
# 2. 确保已配置 Git 推送凭证（SSH Key 或 Git Credential Manager）
# 3. 运行监控脚本
python scripts/watch_docs.py
```

### 数据持久化

- `data/index.json` 是数据源（提交到 Git，作为 GitHub Pages 的初始数据）
- 管理面板的修改保存到浏览器 `localStorage`（跨会话持久化）
- 可通过管理面板导出/导入 JSON 进行备份迁移

## 部署

**自动部署（推荐）：** 推送代码到 GitHub 仓库的 `main` 分支，GitHub Actions 自动部署到 Pages。

**手动部署：**
1. 仓库 Settings -> Pages -> Source 选择 GitHub Actions
2. 推送后等待 Actions 自动完成

自定义域名已在 `CNAME` 文件中配置。

## License

MIT
