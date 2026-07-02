#!/usr/bin/env bash
# 停止 后端 + 前端（不动 Ollama；如需停 Ollama 用菜单栏退出或 pkill ollama）。
set -uo pipefail
echo "■ 停止 项目知识库 …"
for port in 8787 5173; do
  pids=$(lsof -ti :"${port}" 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "  · 关闭端口 ${port} (pid ${pids})"
    echo "${pids}" | xargs kill 2>/dev/null || true
  fi
done
echo "✓ 已停止后端与前端。Ollama 未动（如需释放模型内存：ollama stop <模型> 或退出 Ollama 应用）。"
