#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地后端服务，为知识库提供持久化 API
直接读写 data/index.json，并支持自动推送到 GitHub Pages
"""

import json
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "index.json"

# 将 scripts 目录加入路径以复用 git_pusher
sys.path.insert(0, str(BASE_DIR / "scripts"))
from git_pusher import GitPusher  # noqa: E402


class DeployConfig(BaseModel):
    branch: str = "main"
    remote: str = "origin"
    authorName: str = "Docs Watcher"
    authorEmail: str = "watcher@local"


class Entry(BaseModel):
    id: int
    title: str
    category: str
    tags: list[str] = Field(default_factory=list)
    path: str
    description: str = ""
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    type: str = "markdown"
    content: str = ""


class EntryCreate(BaseModel):
    title: str
    category: str
    tags: list[str] = Field(default_factory=list)
    path: str
    description: str = ""
    createdAt: Optional[str] = None
    type: str = "markdown"
    content: Optional[str] = ""


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    path: Optional[str] = None
    description: Optional[str] = None
    createdAt: Optional[str] = None
    type: Optional[str] = None
    content: Optional[str] = None


def load_index() -> dict:
    """加载 index.json"""
    if not DATA_FILE.exists():
        return {
            "version": "1.0.0",
            "siteTitle": "本地文件知识库",
            "siteDescription": "通过本地后端服务持久化的知识库",
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "entries": [],
            "deletedEntries": [],
        }
    try:
        with open(DATA_FILE, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
            if "deletedEntries" not in data:
                data["deletedEntries"] = []
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取索引失败：{e}")


def save_index(data: dict) -> None:
    """保存 index.json"""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    data["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if "deletedEntries" not in data:
        data["deletedEntries"] = []
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存索引失败：{e}")


def get_next_id(data: dict) -> int:
    """获取下一个可用 ID"""
    if not data.get("entries"):
        return 1
    return max(e.get("id", 0) for e in data["entries"]) + 1


@asynccontextmanager
async def lifespan(app: FastAPI):
    """服务启动时打印信息"""
    print(f"知识库本地服务启动")
    print(f"数据文件：{DATA_FILE}")
    print(f"API 文档：http://localhost:5000/docs")
    yield
    print("知识库本地服务已停止")


app = FastAPI(title="知识库本地服务", lifespan=lifespan)

# 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok", "dataFile": str(DATA_FILE), "exists": DATA_FILE.exists()}


@app.get("/api/entries")
def list_entries():
    return load_index()


@app.post("/api/entries", response_model=Entry)
def create_entry(entry: EntryCreate):
    data = load_index()
    new_entry = {
        "id": get_next_id(data),
        "title": entry.title,
        "category": entry.category,
        "tags": entry.tags,
        "path": entry.path,
        "description": entry.description,
        "createdAt": entry.createdAt or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "type": entry.type or FileType.detect(entry.path),
    }
    data["entries"].append(new_entry)
    save_index(data)
    return new_entry


@app.get("/api/entries/{entry_id}", response_model=Entry)
def get_entry(entry_id: int):
    data = load_index()
    entry = next((e for e in data.get("entries", []) if e.get("id") == entry_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="条目不存在")
    return entry


@app.put("/api/entries/{entry_id}", response_model=Entry)
def update_entry(entry_id: int, update: EntryUpdate):
    data = load_index()
    entry = next((e for e in data.get("entries", []) if e.get("id") == entry_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="条目不存在")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        entry[key] = value

    save_index(data)
    return entry


@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: int):
    data = load_index()
    entry = next((e for e in data.get("entries", []) if e.get("id") == entry_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="条目不存在")

    data["entries"] = [e for e in data.get("entries", []) if e.get("id") != entry_id]
    entry["deletedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data.setdefault("deletedEntries", []).append(entry)
    save_index(data)
    return {"success": True, "deleted": entry_id}


@app.post("/api/upload")
def upload_file(file: UploadFile = File(...)):
    """上传文件到 docs/ 目录，返回相对路径"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    upload_dir = BASE_DIR / "docs"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # 清理文件名，避免覆盖
    safe_name = Path(file.filename).name
    safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-")
    if not safe_name:
        safe_name = "upload"
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    final_name = f"{stem}_{timestamp}{suffix}"
    target = upload_dir / final_name

    try:
        with open(target, "wb") as f:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存文件失败：{e}")
    finally:
        file.file.close()

    relative = f"docs/{final_name}"
    return {"success": True, "path": relative, "filename": final_name}


@app.post("/api/deploy")
def deploy(config: DeployConfig = None):
    """提交并推送到 GitHub"""
    config = config or DeployConfig()

    pusher_config = {
        "branch": config.branch,
        "remote": config.remote,
        "authorName": config.authorName,
        "authorEmail": config.authorEmail,
    }

    pusher = GitPusher(BASE_DIR, pusher_config)

    if not pusher.is_git_repo():
        raise HTTPException(status_code=400, detail="当前目录不是 Git 仓库")
    if not pusher.has_remote():
        raise HTTPException(status_code=400, detail="未配置远程仓库")

    ok, err = pusher.check_auth()
    if not ok:
        raise HTTPException(status_code=403, detail=err)

    ok, info = pusher.commit_and_push([str(DATA_FILE)], "docs: update index from local server")
    if not ok:
        raise HTTPException(status_code=500, detail=info)

    return {"success": True, "message": info}


class FileType:
    """文件类型检测（与前端保持一致）"""

    MAP = {
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

    @classmethod
    def detect(cls, filename: str) -> str:
        ext = Path(filename).suffix.lower().lstrip(".")
        return cls.MAP.get(ext, "other")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=5000)
