# 项目知识库 · 本地优先 AI 知识库

一个**完全本地运行、数据不出本机**的个人 AI 知识库：录入（链接抓取/粘贴/编辑/上传文件）→ 本地大模型自动打标签摘要 → 语义检索 / 相关推荐 / RAG 问答 / 关系图谱。

- 后端：`server/`（Node + Express + 内置 SQLite）
- 前端：`web/`（React + Vite）
- 浏览器剪藏扩展：`extension/`（Chrome MV3，可选）

---

## 一、在新电脑上安装

### 1. 装运行环境（两样）

**① Node.js ≥ 22.5**（本项目用到 Node 内置 `node:sqlite`，必须 22.5 以上；推荐 22 LTS 或更新）
- 官网 https://nodejs.org 下载安装，或用 nvm。
- 验证：`node -v`（应 ≥ v22.5）

**② Ollama（本地大模型，AI 功能依赖它）**
- 官网 https://ollama.com 下载安装。
- 拉两个模型（一个对话、一个向量）：
  ```bash
  ollama pull llama3.1:8b        # 对话模型（也可用 qwen2.5 等，中文更好但更大）
  ollama pull nomic-embed-text   # 向量模型（检索/相关/RAG 必需，约 270MB）
  ```
- 内存建议：8b 对话模型约需 6–8GB 内存；想用 32b 中文模型需 ~20GB。

> 不装 Ollama 也能开页面，但「自动整理 / 检索 / 问答 / 图谱」会不可用。

### 2. 拷贝代码到新电脑

把整个 `app/` 目录拷过去（U 盘 / 网盘 / git 均可）。**不用拷** `node_modules/`、`data/`、`.run/`（这些会自动重建）。

> 如果用 git：本项目目前是本地仓库（在 `app/` 下 `git init` 过），可 `git clone` 或直接复制文件夹。

### 3. 启动

**macOS / Linux（一键）：**
```bash
cd app
./start.sh        # 自动：拉起 Ollama + 装依赖(首次) + 起后端 + 起前端
```
看到 `打开 http://localhost:5173` 即成功。停止：`./stop.sh`

**Windows 或手动启动：**
```bash
# 先确保 Ollama 已运行（装好后一般随系统在后台跑；或命令行 ollama serve）

# 终端 1 — 后端
cd app/server
npm install          # 首次
npm start            # 监听 http://localhost:8787

# 终端 2 — 前端
cd app/web
npm install          # 首次
npm run dev          # http://localhost:5173
```

### 4. 打开使用
浏览器访问 **http://localhost:5173**

---

## 二、数据迁移（把旧电脑的知识带过去）

数据全在旧电脑的 `app/server/data/zkb.sqlite`。两种方式：

- **应用内导出/导入**（推荐）：旧电脑「设置 → 数据与备份 → 导出备份」得到 JSON，新电脑「导入备份」。
- **直接拷库文件**：把旧机 `app/server/data/` 整个目录拷到新机同位置（向量也一起带走，无需重建）。

---

## 三、浏览器剪藏扩展（可选）
见 `extension/README.md`：Chrome `chrome://extensions` 开发者模式 →「加载已解压」→ 选 `app/extension/`。

---

## 四、常见问题

| 现象 | 原因 / 解决 |
|---|---|
| 页面打开但功能报错"模型不可用" | Ollama 没运行或没拉模型；`ollama serve` + `ollama pull` |
| `node:sqlite` 报错 | Node 版本 < 22.5，升级 Node |
| 端口被占用 | 改 `server/.env` 的 `PORT`，或 `app/stop.sh` 后重启 |
| 占内存大 | 在「设置」选小一点的对话模型；或设环境变量 `ZKB_OLLAMA_KEEP_ALIVE=30s`（空闲 30 秒卸载） |
| 想换对话模型 | 设置页「本地模型」下拉，列出已 `ollama pull` 的模型 |

## 五、配置（都有默认，一般不用动）
`server/.env`（参考 `server/.env.example`）：端口、数据目录、Ollama 地址、默认模型、keep_alive、限流等。
