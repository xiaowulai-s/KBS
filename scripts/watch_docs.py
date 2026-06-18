#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
监控 docs 目录变动，自动重新生成 data/index.json
"""

import os
import subprocess
import sys
import time
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = BASE_DIR / "docs"
GENERATE_SCRIPT = BASE_DIR / "scripts" / "generate_index.py"


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
    print("\n检测到文件变动，正在重新生成 index.json...")
    try:
        result = subprocess.run(
            [sys.executable, str(GENERATE_SCRIPT)],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode == 0:
            print(result.stdout)
        else:
            print("生成失败：")
            print(result.stderr)
    except Exception as e:
        print(f"调用生成脚本失败：{e}")


def main():
    """主循环：监控文件变动"""
    if not DOCS_DIR.exists():
        print(f"错误：docs 目录不存在：{DOCS_DIR}")
        return 1

    if not GENERATE_SCRIPT.exists():
        print(f"错误：生成脚本不存在：{GENERATE_SCRIPT}")
        return 1

    print(f"开始监控目录：{DOCS_DIR}")
    print("按 Ctrl+C 停止监控\n")

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

            if added or removed or modified:
                if added:
                    for p in sorted(added):
                        print(f"[+] 新增：{Path(p).name}")
                if removed:
                    for p in sorted(removed):
                        print(f"[-] 删除：{Path(p).name}")
                if modified:
                    for p in sorted(modified):
                        print(f"[*] 修改：{Path(p).name}")

                regenerate_index()
                last_snapshot = current_snapshot
            else:
                print(f"监控中... 当前 {len(current_snapshot)} 个文件", end="\r")

    except KeyboardInterrupt:
        print("\n\n已停止监控")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
