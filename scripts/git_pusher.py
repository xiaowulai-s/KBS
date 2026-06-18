#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git 自动提交与推送模块
"""

import subprocess
from pathlib import Path


class GitPusher:
    """封装 Git 命令，实现检测到变动后的自动提交和推送"""

    def __init__(self, base_dir: Path, config: dict):
        self.base_dir = base_dir
        self.config = config
        self.branch = config.get("branch", "main")
        self.remote = config.get("remote", "origin")
        self.author_name = config.get("authorName", "Docs Watcher")
        self.author_email = config.get("authorEmail", "watcher@local")

    def _run(self, args: list, check: bool = False) -> subprocess.CompletedProcess:
        """执行 Git 命令"""
        return subprocess.run(
            ["git"] + args,
            cwd=self.base_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=check,
        )

    def is_git_repo(self) -> bool:
        """检查当前目录是否为 Git 仓库"""
        result = self._run(["rev-parse", "--git-dir"])
        return result.returncode == 0

    def has_remote(self) -> bool:
        """检查是否配置了远程仓库"""
        result = self._run(["remote", "-v"])
        return result.returncode == 0 and bool(result.stdout.strip())

    def check_auth(self) -> tuple[bool, str]:
        """检查是否有推送权限（使用 dry-run）"""
        result = self._run(["push", "--dry-run", self.remote, self.branch])
        if result.returncode == 0:
            return True, ""

        err = result.stderr or result.stdout
        if "could not resolve" in err.lower():
            return False, "无法连接远程仓库，请检查网络"
        if "permission" in err.lower() or "access" in err.lower():
            return False, "没有推送权限，请配置 SSH Key 或 Personal Access Token"
        if "authenti" in err.lower():
            return False, "认证失败，请检查 Git 凭证"
        return False, err.strip()

    def has_changes(self) -> bool:
        """检查工作区是否有未提交的变更"""
        result = self._run(["status", "--porcelain"])
        return result.returncode == 0 and bool(result.stdout.strip())

    def has_staged_changes(self) -> bool:
        """检查暂存区是否有待提交的变更"""
        result = self._run(["diff", "--cached", "--stat"])
        return result.returncode == 0 and bool(result.stdout.strip())

    def commit_and_push(self, changed_files: list[str], message: str) -> tuple[bool, str]:
        """
        提交变更并推送到远程仓库
        返回: (是否成功, 提示信息)
        """
        if not self.has_changes():
            return True, "没有需要提交的变更"

        # 添加变更文件
        add_paths = []
        for p in changed_files:
            rel_path = Path(p).relative_to(self.base_dir)
            add_paths.append(str(rel_path))

        # 必须包含 index.json
        index_json = self.base_dir / "data" / "index.json"
        if index_json.exists() and str(index_json) not in changed_files:
            add_paths.append("data/index.json")

        add_result = self._run(["add"] + add_paths)
        if add_result.returncode != 0:
            return False, f"git add 失败：{add_result.stderr.strip()}"

        if not self.has_staged_changes():
            return True, "没有需要提交的变更"

        # 提交
        commit_args = [
            "commit",
            "-m", message,
            f"--author={self.author_name} <{self.author_email}>",
        ]
        commit_result = self._run(commit_args)
        if commit_result.returncode != 0:
            # 如果提交失败，尝试回滚 add 状态
            self._run(["reset", "HEAD"])
            return False, f"git commit 失败：{commit_result.stderr.strip()}"

        # 提交后，如果工作区仍有其他未提交修改，临时 stash 以便 pull --rebase
        stashed = False
        if self.has_changes():
            stash_result = self._run(["stash", "push", "-u", "-m", "auto-push temp stash"])
            if stash_result.returncode == 0:
                stashed = True

        # 推送前拉取更新（rebase 避免冲突）
        pull_result = self._run(["pull", "--rebase", self.remote, self.branch])
        if pull_result.returncode != 0:
            if stashed:
                self._run(["stash", "pop"])
            self._run(["rebase", "--abort"])
            return False, f"git pull --rebase 失败：{pull_result.stderr.strip()}"

        # 推送
        push_result = self._run(["push", self.remote, self.branch])
        if push_result.returncode != 0:
            if stashed:
                self._run(["stash", "pop"])
            return False, f"git push 失败：{push_result.stderr.strip()}"

        # 恢复临时 stash 的修改
        if stashed:
            self._run(["stash", "pop"])

        return True, "已成功提交并推送到远程仓库"
