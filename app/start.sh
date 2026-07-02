#!/usr/bin/env bash
# 一键启动：Ollama（如未运行）+ 后端 + 前端。日志写到 app/.run/。
set -euo pipefail
cd "$(dirname "$0")"
RUN_DIR=".run"
mkdir -p "${RUN_DIR}"

OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
BACK_PORT="${PORT:-8787}"
FRONT_PORT=5173

echo "▶ 项目知识库 启动中…"

# 1) Ollama
if curl -s --max-time 3 "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
  echo "  ✓ Ollama 已在运行（${OLLAMA_URL}）"
else
  if command -v ollama >/dev/null 2>&1; then
    echo "  · 启动 Ollama…"
    ollama serve > "${RUN_DIR}/ollama.log" 2>&1 &
    for _ in $(seq 1 15); do
      curl -s --max-time 2 "${OLLAMA_URL}/api/tags" >/dev/null 2>&1 && break
      sleep 1
    done
    if curl -s --max-time 2 "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
      echo "  ✓ Ollama 就绪"
    else
      echo "  ⚠ Ollama 未就绪，AI 功能将不可用（请手动 ollama serve）"
    fi
  else
    echo "  ⚠ 未找到 ollama 命令；请先安装 Ollama 并拉取模型（见 README）"
  fi
fi

# 2) 依赖（缺则装）
[ -d server/node_modules ] || (echo "  · 安装后端依赖…" && (cd server && npm install))
[ -d web/node_modules ]   || (echo "  · 安装前端依赖…" && (cd web && npm install))

# 3) 后端
if lsof -ti :"${BACK_PORT}" >/dev/null 2>&1; then
  echo "  ✓ 后端端口 ${BACK_PORT} 已占用（可能已在运行），跳过"
else
  echo "  · 启动后端 :${BACK_PORT} …"
  (cd server && npm start > "../${RUN_DIR}/backend.log" 2>&1 &)
  for _ in $(seq 1 20); do
    curl -s --max-time 2 "http://localhost:${BACK_PORT}/api/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi

# 4) 前端
if lsof -ti :"${FRONT_PORT}" >/dev/null 2>&1; then
  echo "  ✓ 前端端口 ${FRONT_PORT} 已占用，跳过"
else
  echo "  · 启动前端 :${FRONT_PORT} …"
  (cd web && npm run dev > "../${RUN_DIR}/frontend.log" 2>&1 &)
  sleep 4
fi

echo ""
echo "✅ 启动完成 → 打开 http://localhost:${FRONT_PORT}"
echo "   日志：app/${RUN_DIR}/ 下的 ollama.log / backend.log / frontend.log"
echo "   停止：./stop.sh"
