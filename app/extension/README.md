# 项目知识库 · 一键剪藏扩展（Chrome MV3）

把当前网页 / 微信公众号文章一键存入本地知识库。用浏览器**已渲染、已登录**的页面取正文，天然绕过公众号等反爬。

## 工作原理
弹窗点「剪藏」→ 在当前标签页取 `document.documentElement.outerHTML` + `location.href` → POST 到后端 `POST /api/ingest/clip` → 后端复用 `extractArticle`（含公众号适配）提取正文、清洗脚本、入库并触发 AI 自动打标签/摘要。

## 安装（开发者模式加载）
1. 先启动本地后端（`app/start.sh` 或 `cd app/server && npm start`），确认 http://localhost:8787/api/health 可访问。
2. Chrome 打开 `chrome://extensions/`，右上角开「开发者模式」。
3. 点「加载已解压的扩展程序」，选择本目录 `app/extension/`。
4. 工具栏出现扩展图标；在任意文章页点它 → 点「📎 剪藏当前页面」。

## 配置
- 弹窗底部「后端地址」默认 `http://localhost:8787`，改了会存在扩展本地存储。
- 剪藏成功后弹窗给出「打开查看 →」链接（指向前端 http://localhost:5173）。

## 权限说明
- `activeTab` + `scripting`：仅在你点击时读取当前标签页内容。
- `host_permissions: http://localhost/*, http://127.0.0.1/*`：只与本机后端通信，数据不出本机。
