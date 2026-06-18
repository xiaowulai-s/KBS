#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
启动本地后端服务
用法：python server/start.py [--port 5000]
"""

import argparse
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REQUIREMENTS = BASE_DIR / "server" / "requirements.txt"


def ensure_dependencies():
    """确保依赖已安装"""
    try:
        import fastapi  # noqa: F401
        import uvicorn  # noqa: F401
        import pydantic  # noqa: F401
    except ImportError:
        print("正在安装依赖...")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
            cwd=BASE_DIR,
        )
        if result.returncode != 0:
            print("依赖安装失败，请手动运行：pip install -r server/requirements.txt")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="启动知识库本地后端服务")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=5000, help="监听端口")
    parser.add_argument("--reload", action="store_true", help="启用热重载（开发模式）")
    args = parser.parse_args()

    ensure_dependencies()

    print(f"启动服务：http://{args.host}:{args.port}")
    print("按 Ctrl+C 停止")

    from uvicorn import main as uvicorn_main

    sys.argv = [
        "uvicorn",
        "server.main:app",
        "--host", args.host,
        "--port", str(args.port),
    ]
    if args.reload:
        sys.argv.append("--reload")
    uvicorn_main()


if __name__ == "__main__":
    main()
