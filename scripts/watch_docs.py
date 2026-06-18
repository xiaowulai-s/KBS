#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
监控 docs 目录变动，自动重新生成 data/index.json
可选：自动提交并推送到 GitHub Pages
"""

import json
import os
import sys
import time
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = BASE_DIR / "docs"
CONFIG_FILE = BASE_DIR / "scripts" / "config.json"

# 将项目根目录加入路径，以便导入 generate_index
sys.path.insert(0, str(BASE_DIR / "scripts"))
from generate_index import main as generate_index_main
from git_pusher import GitPusher


class ChangeBuffer:
    """收集文件变动，去抖后统一处理"""

    def __init__(self, debounce_seconds: int = 10):
        self.debounce_seconds = debounce_seconds
        self.changes = {}  # path -> change_type
        self.last_change_time = 0

    def add(self, file_path: str, change_type: str):
        """记录一次文件变动"""
        self.changes[file_path] = change_type
        self.last_change_time = time.time()

    def should_flush(self) -> bool:
        """判断是否应该刷新缓冲区"""
        if not self.changes:
            return False
        return time.time() - self.last_change_time > self.debounce_seconds

    def flush(self) -> tuple[list[str], str]:
        """清空缓冲区并返回变动文件列表和提交信息"""
        changes = dict(self.changes)
        self.changes.clear()

        file_names = [Path(p).name for p in changes.keys()]
        types = set(changes.values())

        if len(file_names) == 1:
            name = file_names[0]
            if "added" in types:
                message = f"docs: add {name}"
            elif "removed" in types:
                message = f"docs: remove {name}"
            else:
                message = f"docs: update {name}"
        else:
            message = "docs: auto-update multiple files"

        return list(changes.keys()), message


def load_config() -> dict:
    """加载监控脚本配置"""
    default_config = {
        "autoPush": {
            "enabled": False,
            "branch": "main",
            "remote": "origin",
            "debounceSeconds": 10,
            "commitMessage": "docs: auto-update index from watcher",
            "authorName": "Docs Watcher",
            "authorEmail": "watcher@local",
        }
    }

    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                user_config = json.load(f)
            default_config.update(user_config)
        except Exception as e:
            print(f"警告：读取配置文件失败，使用默认配置：{e}")

    return default_config


def get_files_snapshot(directory: Path) -> dict:
    """获取目录下所有文件的状态快照（路径 -> 修改时间）"""
    snapshot = {}
    if not directory.exists():
        return snapshot
    for root, _, files in os.walk(directory):
        for name in files:
            file_path = Path(root) / name
            try:
                snapshot[str(file_path.resolve())] = file_path.stat().st_mtime
            except OSError:
                pass
    return snapshot


def regenerate_index():
    """调用 generate_index.py 重新生成索引"""
    print("\n检测到文件变动，正在重新生成 index.json...", flush=True)
    try:
        generate_index_main()
    except Exception as e:
        print(f"生成失败：{e}", flush=True)
        raise


def check_environment(pusher: GitPusher, auto_push_enabled: bool) -> bool:
    """启动前环境检查"""
    if auto_push_enabled:
        if not pusher.is_git_repo():
            print("错误：当前目录不是 Git 仓库，无法启用自动推送")
            print("提示：请先用 git init 初始化仓库，或关闭 autoPush.enabled")
            return False

        if not pusher.has_remote():
            print("错误：未配置远程仓库，无法启用自动推送")
            print("提示：请先用 git remote add origin <url> 添加远程仓库")
            return False

        print("正在检查推送权限...")
        ok, err = pusher.check_auth()
        if not ok:
            print(f"错误：{err}")
            print("提示：请配置 SSH Key 或 Git Credential Manager")
            return False
        print("推送权限检查通过")

    return True


def main():
    """主循环：监控文件变动"""
    if not DOCS_DIR.exists():
        print(f"错误：docs 目录不存在：{DOCS_DIR}")
        return 1

    config = load_config()
    push_config = config.get("autoPush", {})
    auto_push_enabled = bool(push_config.get("enabled", False))

    debounce = int(push_config.get("debounceSeconds", 10))
    buffer = ChangeBuffer(debounce_seconds=debounce)
    pusher = GitPusher(BASE_DIR, push_config)

    print(f"开始监控目录：{DOCS_DIR}")
    print(f"自动推送：{'已启用' if auto_push_enabled else '已禁用'}")
    if auto_push_enabled:
        print(f"目标分支：{push_config.get('remote', 'origin')} / {push_config.get('branch', 'main')}")
        print(f"去抖时间：{debounce} 秒")
    print("按 Ctrl+C 停止监控\n")

    if not check_environment(pusher, auto_push_enabled):
        return 1

    last_snapshot = get_files_snapshot(DOCS_DIR)

    try:
        while True:
            time.sleep(2)
            current_snapshot = get_files_snapshot(DOCS_DIR)

            # 检测新增、删除、修改
            added = set(current_snapshot.keys()) - set(last_snapshot.keys())
            removed = set(last_snapshot.keys()) - set(current_snapshot.keys())
            modified = {
                p for p in current_snapshot
                if p in last_snapshot and current_snapshot[p] != last_snapshot[p]
            }

            # 记录变动到缓冲区
            for p in added:
                buffer.add(p, "added")
                print(f"[+] 新增：{Path(p).name}")
            for p in removed:
                buffer.add(p, "removed")
                print(f"[-] 删除：{Path(p).name}")
            for p in modified:
                buffer.add(p, "modified")
                print(f"[*] 修改：{Path(p).name}")

            # 去抖后统一处理
            if buffer.should_flush():
                try:
                    regenerate_index()
                    changed_files, message = buffer.flush()

                    if auto_push_enabled:
                        print("正在提交并推送到 GitHub...", flush=True)
                        ok, info = pusher.commit_and_push(changed_files, message)
                        if ok:
                            print(f"✅ {info}", flush=True)
                        else:
                            print(f"❌ {info}", flush=True)

                except Exception as e:
                    print(f"处理失败：{e}", flush=True)

                last_snapshot = get_files_snapshot(DOCS_DIR)
            else:
                if not buffer.changes:
                    print(f"监控中... 当前 {len(current_snapshot)} 个文件", end="\r", flush=True)

    except KeyboardInterrupt:
        print("\n\n已停止监控")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
