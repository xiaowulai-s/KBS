# 本地文件知识库

一个基于 GitHub Pages 部署的静态网页应用，用于将本地文件整理成结构化的在线知识库。

## 功能特性

- **知识库展示** - 卡片式网格布局，美观直观
- **全文搜索** - 基于 MiniSearch 的前端全文检索
- **分类筛选** - 按分类和标签过滤文件
- **Markdown 预览** - 点击卡片即可查看 Markdown 文件内容
- **管理面板** - 增删改查索引条目
- **JSON 导入导出** - 备份和恢复数据
- **响应式设计** - 完美适配桌面和移动设备

## 快速开始

1. 克隆或下载本项目
2. 编辑 `data/index.json` 添加你的文件条目
3. 将文件推送到 GitHub 仓库
4. 在 Settings -> Pages 中启用 GitHub Pages
5. 访问 `https://<username>.github.io/<repo-name>`

## 添加条目

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

## 项目结构

```
├── index.html          # 主页入口
├── css/
│   └── style.css       # 全局样式
├── js/
│   ├── app.js          # 主逻辑
│   └── admin.js        # 管理面板
├── data/
│   └── index.json      # 索引数据库
├── docs/               # 示例文档存放区
├── README.md           # 项目说明
└── .github/
    └── workflows/
        └── deploy.yml  # CI/CD 配置
```

## 部署

使用 GitHub Pages 静态托管即可：
1. 推送代码到 GitHub 仓库
2. 仓库 Settings -> Pages -> Source 选择 main 分支
3. 部署后可通过 `https://<username>.github.io/<repo>` 访问

## License

MIT
