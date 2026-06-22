#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
扫描 docs 目录并生成 data/index.json 索引文件
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


# 项目根目录（脚本位于 scripts/ 目录下）
BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = BASE_DIR / "docs"
DATA_DIR = BASE_DIR / "data"
OUTPUT_FILE = DATA_DIR / "index.json"

# 支持的文件类型映射
FILE_TYPES = {
    "md": "markdown",
    "markdown": "markdown",
    "mdx": "markdown",
    "pdf": "pdf",
    "jpg": "image",
    "jpeg": "image",
    "png": "image",
    "gif": "image",
    "webp": "image",
    "svg": "image",
    "bmp": "image",
    "ico": "image",
    "mp4": "video",
    "webm": "video",
    "ogg": "video",
    "mov": "video",
    "avi": "video",
    "mp3": "audio",
    "wav": "audio",
    "flac": "audio",
    "aac": "audio",
    "txt": "text",
    "json": "text",
    "csv": "text",
}

# 分类关键词映射（根据文件名/路径自动推断）
CATEGORY_KEYWORDS = {
    "编程教程": ["js", "javascript", "css", "html", "python", "教程", "基础"],
    "项目管理": ["需求", "项目", "计划", "规划", "roadmap"],
    "团队协作": ["会议", "纪要", "团队", "周会", "日报"],
    "技术文档": ["api", "规范", "设计", "架构", "接口", "协议"],
    "学习笔记": ["笔记", "学习", "总结"],
}


def detect_file_type(filename: str) -> str:
    """根据扩展名检测文件类型"""
    ext = Path(filename).suffix.lower().lstrip(".")
    return FILE_TYPES.get(ext, "other")


def extract_title_from_markdown(file_path: Path) -> str:
    """从 Markdown 文件中提取第一个 # 标题"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#"):
                    return re.sub(r"^#+\s*", "", line).strip()
    except Exception:
        pass
    return ""


def extract_description_from_markdown(file_path: Path, max_length: int = 120) -> str:
    """从 Markdown 文件中提取第一段非空文本作为描述"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            # 移除代码块
            content = re.sub(r"```[\s\S]*?```", "", content)
            # 移除行内代码、链接、图片
            content = re.sub(r"`[^`]*`", "", content)
            content = re.sub(r"!\[.*?\]\(.*?\)", "", content)
            content = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", content)
            # 获取第一段文字
            paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
            for p in paragraphs:
                text = re.sub(r"^#+\s*", "", p).strip()
                text = text.replace("\n", " ")
                if text and not text.startswith("---"):
                    if len(text) > max_length:
                        text = text[:max_length] + "..."
                    return text
    except Exception:
        pass
    return ""


def infer_category(filename: str, title: str, description: str) -> str:
    """根据文件名、标题、描述推断分类"""
    combined = f"{filename} {title} {description}".lower()
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in combined)
        if score > 0:
            scores[category] = score
    if scores:
        return max(scores, key=scores.get)
    # 默认分类
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext == "pdf":
        return "技术文档"
    if ext in FILE_TYPES and FILE_TYPES[ext] == "image":
        return "图片资源"
    return "未分类"


def generate_tags(filename: str, title: str, category: str, file_type: str) -> list:
    """生成默认标签"""
    tags = []
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext:
        tags.append(ext.upper() if ext in {"pdf", "api"} else ext.capitalize())
    if file_type == "markdown":
        tags.append("文档")
    if category and category != "未分类":
        tags.append(category)
    return tags[:3]


def load_existing_index() -> dict:
    """加载已有的 index.json，保留用户手动维护的元数据"""
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception as e:
            print(f"警告：读取现有 index.json 失败：{e}")
    return {}


def scan_docs() -> list:
    """扫描 docs 目录生成条目列表"""
    existing = load_existing_index()
    existing_entries = {e["path"]: e for e in existing.get("entries", []) if "path" in e}

    entries = []
    file_id = 1

    for file_path in sorted(DOCS_DIR.iterdir()):
        if not file_path.is_file():
            continue

        relative_path = f"docs/{file_path.name}"
        file_type = detect_file_type(file_path.name)

        # 如果已有条目，保留用户手动设置的数据
        if relative_path in existing_entries:
            entry = existing_entries[relative_path].copy()
            entry.setdefault("id", file_id)
            entry.setdefault("type", file_type)
            entries.append(entry)
            file_id += 1
            continue

        # 自动生成元数据
        title = ""
        description = ""
        if file_type == "markdown":
            title = extract_title_from_markdown(file_path)
            description = extract_description_from_markdown(file_path)

        if not title:
            title = Path(file_path.name).stem.replace("-", " ").replace("_", " ")
            title = title.title() if file_type != "pdf" else title.upper()

        if not description:
            description = f"{title} 相关文件"

        category = infer_category(file_path.name, title, description)
        tags = generate_tags(file_path.name, title, category, file_type)

        # 获取文件修改时间
        mtime = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
        created_at = mtime.strftime("%Y-%m-%d")

        entry = {
            "id": file_id,
            "title": title,
            "category": category,
            "tags": tags,
            "path": relative_path,
            "description": description,
            "createdAt": created_at,
            "type": file_type,
        }
        entries.append(entry)
        file_id += 1

    return entries


def main():
    """主函数"""
    if not DOCS_DIR.exists():
        print(f"错误：docs 目录不存在：{DOCS_DIR}")
        return 1

    DATA_DIR.mkdir(exist_ok=True)

    existing = load_existing_index()
    entries = scan_docs()

    # Deduplicate IDs: ensure all entries have unique IDs
    seen_ids = set()
    new_id = max((e.get("id", 0) for e in entries), default=0)
    deduped_entries = []
    for entry in entries:
        eid = entry.get("id", new_id + 1)
        while eid in seen_ids:
            new_id += 1
            eid = new_id
        entry["id"] = eid
        seen_ids.add(eid)
        new_id = max(new_id, eid + 1)
        deduped_entries.append(entry)

    index_data = {
        "version": existing.get("version", "1.0.0"),
        "siteTitle": existing.get("siteTitle", "本地文件知识库"),
        "siteDescription": existing.get(
            "siteDescription", "通过 GitHub Pages 分享的本地文件知识库"
        ),
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entries": deduped_entries,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)

    print(f"成功生成索引文件：{OUTPUT_FILE}")
    print(f"共扫描 {len(entries)} 个文件")
    for entry in entries:
        print(f"  [{entry['id']}] {entry['title']} ({entry['type']})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
