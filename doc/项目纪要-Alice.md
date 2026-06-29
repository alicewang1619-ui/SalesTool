# Alice · 项目纪要

- 项目目标：为 Ultrasound 海外销售团队设计「智能销售接待与客户洞察 Agent」，解决询盘来源分散、在线响应不及时、客户调研耗时、人工分发与销售反馈断裂、报表分析缺失等问题。
- 约束：第一版按用户确认的原 V1 执行，暂不接 Facebook / LinkedIn 官方 API 或个人后台，不做未授权抓取；再营销内容由 AI 起草、人工确认后发送；指标不统计成交金额和报价金额。

## 当前状态
- ✅ 已完成：已安装全局提示词、PRD master、design master；已完成 PRD 深挖、价值论证、竞品调研、V1 方案、MVP 边界确认；已生成并交付 PRD 详细版、老板版、开发版、PPT 大纲、10 页 HTML 方案 PPT和可下载 PPTX；`state.json` 已更新到 6.2 交付完成。
- ▶️ 进行中：等待用户确认是否进入设计阶段。
- ⏸️ 待办：可进入 design master，把 PRD 落成页面、设计系统和技术方案。
- ❓ 待确认：是否在 PRD 完成后立即进入设计阶段。

## 决策记录（实时追加，宁滥勿缺）
- [06-29-2026 14:57:29] 继续 PRD 终交付｜背景：用户在确认「先不接 FB 和 LinkedIn，按照原来的 V1 做」后发送“继续”，需要从当前 PRD master 进度往下推进。｜结论：本回合继续完成原 V1 的 PRD/PPT 收尾，不把 Facebook/LinkedIn 放入第一版必做范围。｜来源：用户
- [06-29-2026 14:57:29] 时间命令兼容处理｜背景：项目规则要求用 `date '+%m-%d-%Y %H:%M:%S'` 取本地时间，但当前 PowerShell 将 `date` 解析为 `Get-Date` 并执行失败，且环境没有 Bash。｜结论：本项目在 Windows PowerShell 环境下使用等价的 `Get-Date -Format 'MM-dd-yyyy HH:mm:ss'` 产出同格式时间戳。｜来源：AI
- [06-29-2026 14:58:22] PRD 项目状态收尾｜背景：PRD 详细版、老板版、开发版和 PPT HTML 已生成，但 `state.json` 仍停留在 4.6 MVP 边界确认阶段。｜结论：将项目状态更新为阶段 6.2 交付完成，并把最终 PRD、分层 PRD 和 PPT 文件写入 deliverables。｜来源：AI
- [06-29-2026 15:02:48] 查看汇报 PPT｜背景：PRD/PPT 已交付后，用户要求“看汇报 PPT”。｜结论：打开本地方案 PPT 首页 `智能销售接待与客户洞察Agent/output/ppt/p01.html` 给用户查看。｜来源：用户
- [06-29-2026 15:04:11] PPT 本地预览方式｜背景：应用内浏览器安全策略拦截直接访问 `file://` 本地 HTML 文件。｜结论：改用只绑定 `127.0.0.1` 的本地静态预览服务打开 PPT，避免通过 `file://` 访问本地文件。｜来源：AI
- [06-29-2026 15:08:04] 生成可下载 PPTX｜背景：用户在应用内浏览器已打开 HTML 汇报 PPT 第 10 页后，要求“变成可以下载的PPT”。｜结论：生成可下载的 PowerPoint `.pptx` 文件，并在 HTML 汇报页增加下载入口。｜来源：用户
- [06-29-2026 15:13:44] PPTX 生成方式与文件名｜背景：本地环境没有 `python-pptx` / `pptxgenjs`，且中文路径经 PowerShell 管道进入 Python 时存在编码替换问题。｜结论：采用浏览器渲染截图 + OpenXML 打包的方式生成 PPTX；下载文件名使用 `ultrasound-sales-agent-report.pptx`，放在 `output/ppt/` 目录，供当前本地预览服务直接下载。｜来源：AI

## 待解决问题

- 是否进入 design master 阶段。

## 工作文件集

- `智能销售接待与客户洞察Agent/state.json`
- `智能销售接待与客户洞察Agent/conversation.md`
- `智能销售接待与客户洞察Agent/scene-anchor.md`
- `智能销售接待与客户洞察Agent/proposal-v1.md`
- `智能销售接待与客户洞察Agent/output/PRD详细版.md`
- `智能销售接待与客户洞察Agent/output/PRD-summary.md`
- `智能销售接待与客户洞察Agent/output/PRD-dev.md`
- `智能销售接待与客户洞察Agent/output/ppt.md`
- `智能销售接待与客户洞察Agent/output/ppt/p01.html`
- `智能销售接待与客户洞察Agent/output/ppt/ultrasound-sales-agent-report.pptx`
