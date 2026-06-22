#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
根据 data/index.json 生成 feed.xml RSS Feed
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_FILE = BASE_DIR / "data" / "index.json"
FEED_FILE = BASE_DIR / "feed.xml"

SITE_TITLE = "本地文件知识库"
SITE_URL = "https://houxixi.ccwu.cc/"


def sanitize_xml(text: str) -> str:
    """转义 XML 特殊字符"""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&apos;")
    return text


def extract_description_from_md(file_path: Path, max_length: int = 200) -> str:
    """从 Markdown 文件中提取前 200 字作为摘要"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        # 移除代码块
        content = re.sub(r"```[\s\S]*?```", "", content)
        # 移除行内代码
        content = re.sub(r"`[^`]*`", "", content)
        # 移除图片
        content = re.sub(r"!\[.*?\]\(.*?\)", "", content)
        # 移除链接括号，保留链接文本
        content = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", content)
        # 移除标题符号
        content = re.sub(r"^#+\s*", "", content, flags=re.MULTILINE)
        # 获取第一段文字
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        for p in paragraphs:
            text = p.replace("\n", " ").strip()
            if text and not text.startswith("---"):
                if len(text) > max_length:
                    text = text[:max_length] + "..."
                return text
    except Exception:
        pass
    return "暂无摘要"


def generate_rss():
    """生成 RSS 2.0 Feed"""
    if not INDEX_FILE.exists():
        print(f"错误：index.json 不存在：{INDEX_FILE}")
        return 1

    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    entries = sorted(data.get("entries", []), key=lambda e: e.get("createdAt", ""), reverse=True)
    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    items = []
    for entry in entries:
        title = sanitize_xml(entry.get("title", "未命名"))
        path = entry.get("path", "")
        file_type = entry.get("type", "other")
        desc_raw = entry.get("description", "暂无描述")

        # 如果 description 为空或太短，尝试从文件提取
        use_custom_desc = False
        if len(desc_raw) < 20:
            # Only try to extract description from markdown files
            if file_type == "markdown":
                file_path = BASE_DIR / path
                if file_path.exists():
                    desc_raw = extract_description_from_md(file_path)
                    use_custom_desc = True

        # If we didn't customize the description, use the one from index.json directly
        if not use_custom_desc and desc_raw == entry.get("title", ""):
            # Description equals title, use the description field
            desc_raw = entry.get("description", "暂无描述")

        description = sanitize_xml(desc_raw[:200])
        pub_date = entry.get("createdAt", "")
        if pub_date:
            try:
                dt = datetime.strptime(pub_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                pub_date_str = dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
            except ValueError:
                pub_date_str = now
        else:
            pub_date_str = now

        # GUID 使用 URL 路径参数形式
        guid = f"{SITE_URL}/?id={entry.get('id', '')}"
        link = guid

        category_tags = entry.get("tags", [])
        categories = ""
        for cat in category_tags[:3]:
            categories += f"\n      <category>{sanitize_xml(cat)}</category>"

        item = f"""    <item>
      <title><![CDATA[{title}]]></title>
      <link>{link}</link>
      <description><![CDATA[{description}]]></description>
      <pubDate>{pub_date_str}</pubDate>
      <guid>{guid}</guid>{categories}
    </item>"""
        items.append(item)

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{sanitize_xml(SITE_TITLE)}</title>
    <link>{SITE_URL}</link>
    <description>通过 GitHub Pages 分享的本地文件知识库</description>
    <language>zh-CN</language>
    <lastBuildDate>{now}</lastBuildDate>
    <generator>KKnowledge Base RSS Generator</generator>
    <atom:link href="{SITE_URL}feed.xml" rel="self" type="application/rss+xml"/>
{"".join(items)}
  </channel>
</rss>"""

    with open(FEED_FILE, "w", encoding="utf-8") as f:
        f.write(rss)

    print(f"成功生成 RSS Feed: {FEED_FILE}")
    print(f"共包含 {len(items)} 条记录")
    return 0


if __name__ == "__main__":
    raise SystemExit(generate_rss())
