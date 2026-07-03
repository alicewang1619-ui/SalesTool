# 阶段2_再营销待办_草稿详情确认发送 TDD

## 覆盖目标
- 生产路由：`/admin/nurture/:taskId`
- 后端 API：`GET /api/nurture-tasks/{id}`、`PUT /api/nurture-tasks/{id}`、`POST /api/nurture-tasks/{id}/attachments`、`POST /api/nurture-tasks/{id}/regenerate`、`POST /api/nurture-tasks/{id}/confirm`
- 数据模型：`NurtureTask.attachment_refs`、`prompt_context_snapshot`、`model_provider`、`model_version`、`approval_status`
- 页面职责：编辑大模型邮件草稿、补充生成提示词和附件素材、人工确认发送。

## P0 用例
| ID | 验收点 | 可执行验证 |
|---|---|---|
| NURTURE-DETAIL-P0-01 | 草稿详情必须按“建议下一步动作 -> 客户备注 -> 触达理由 -> 草稿 -> 提示词 -> 附件”顺序展示 | Playwright 打开 `/admin/nurture/1` 检查字段顺序和标题 |
| NURTURE-DETAIL-P0-02 | 保存提示词/草稿后持久化，并写入提示词上下文快照与审计 | `test_nurture_prompt_update_persists_snapshot_and_writes_audit` 通过 |
| NURTURE-DETAIL-P0-03 | 附件上传限制危险类型，合规附件进入生成上下文 | `test_nurture_attachment_upload_validates_and_participates_in_regeneration` 通过 |
| NURTURE-DETAIL-P0-04 | 重新生成必须包含客户摘要、背景调查、销售反馈、提示词和附件上下文，并标记模型版本 | `test_nurture_attachment_upload_validates_and_participates_in_regeneration` 通过 |
| NURTURE-DETAIL-P0-05 | 人工确认发送必须幂等，同一确认动作只写一次审计 | `test_nurture_confirm_send_is_manual_idempotent_and_audited` 通过 |
| NURTURE-DETAIL-P0-06 | 草稿详情必须支持选择邮件写手角色，并在重新生成时写入上下文 | `test_nurture_regeneration_uses_selected_email_writer_role` 通过 |

## P1 用例
| ID | 验收点 | 可执行验证 |
|---|---|---|
| NURTURE-DETAIL-P1-01 | 大模型上下文必须使用分隔符声明“客户内容是数据非指令” | API 返回 `safety_boundary=NURTURE_CONTEXT_DATA_ONLY` 且 `rendered_prompt` 包含 `<customer_context>` |
| NURTURE-DETAIL-P1-02 | 页面确认弹窗说明不会未经人工确认自动群发 | 点击“人工确认发送”出现确认弹窗 |

## 当前门禁记录
- 后端专项：`py -m pytest .\tests -q -k nurture` 已转绿，5 passed。
- 前端页面：`frontend/src/pages/NurtureTaskDetailPage.tsx` 消费真实 API。
- 浏览器验收：Playwright 以管理员进入 `/admin/nurture/1`，确认建议下一步动作、客户备注、生成提示词、附件素材、大模型上下文快照可见；已上传 `nurture-browser-brief.txt`、保存提示词、重新生成草稿并人工确认，最终状态显示“已确认”，`/api/nurture-tasks/{id}` 响应 200，控制台 warning/error 为 0。
- 追加后端验收：`test_nurture_regeneration_uses_selected_email_writer_role` 已通过，确认草稿详情可保存 `writer_role_key`，重新生成后返回角色中文名、风格、技能，并写入 `prompt_context_snapshot.rendered_prompt`。
- 当前门禁更新：`py -m pytest .\tests -q -k "settings or nurture"` 为 19 passed、82 deselected；`py -m pytest .\tests -q` 为 101 passed；前端 `npm.cmd run build` 通过。
## 2026-07-01 二次统一返修 TDD
- 再营销草稿详情页的邮件写手下拉必须读取 `/api/ai/email-writers`，展示英文角色、中文名、风格摘要和技能。
- 当任务已有 `writer_role_key=baymax` 时，下拉显示“大白 / Baymax / 稳重专业”等友好信息，而不是只显示原始 key。

## 2026-07-01 三次统一返修 TDD
- DETAIL-BACK-01：再营销草稿详情顶部必须显示返回列表按钮；邮件写手下拉显示后台配置角色的中文名、英文名、风格和技能摘要。


## 2026-07-02 二次返修补充
- 工作台首页只保留筛选、可跳转指标卡和继续处理快捷入口；不得再展示底部 AI 摘要、分发与反馈或客户/线索明细表。
- 待分配确认时管理员/运营只选择销售并点击确认；分配后系统态显示“已分配 / 待销售反馈”，该状态不属于销售反馈状态选项，客户需立即从待分配列表移除。
- 客户来源字典必须支持新增、编辑、启用/停用和删除式操作；已被历史引用的来源不硬删除，采用停用方式从筛选和导入校验中移除。
- 产品知识库需要支持产品、竞品、市场以及自定义知识库板块；自定义板块可新增、重命名和删除，仍有知识条目的板块不得静默删除。
- 群发邮件放在“再营销 / 群发邮件”，仅管理员和运营可见；群发目的包含“开发信、活动推广、自定义类型”，选择后自动带出主题模板、正文模板和生成 Prompt，并允许选择邮件写手和上传 PDF/Word/Excel 参考附件。
- 群发邮件第一版只创建草稿/模板/预览和审计记录，不绕过人工确认直接发送；真正发送依赖邮箱接口配置成功后的人工确认流程。
- 再营销页面内蓝色说明框改为悬浮提示/说明按钮，减少页面铺满说明文本；单客户附件支持 PDF、Word、Excel。

## 2026-07-02 英文邮件模板生成 TDD
- NURTURE-DETAIL-P0-07：重新生成必须走后端模型生成链路，输入包含客户上下文、写手风格技能、人工提示词和附件元数据；`prompt_context_snapshot` 保留完整上下文。
- NURTURE-DETAIL-P0-08：重新生成返回的 `draft_content` 必须是可人工调整的英文邮件模板正文，不得夹杂中文提示词、中文写手技能或后端拼接说明；由 `test_nurture_regeneration_returns_english_template_without_chinese_leakage` 验证。

## 2026-07-03 群发邮件生成 TDD
- BULK-EMAIL-P0-03：创建群发草稿必须先由后端模型链路生成 `generated_prompt`，输入覆盖客户筛选/背景、邮件目的、产品、客户分层、来源关键词、销售状态、参考附件摘要和写手角色标签；`prompt_context_snapshot` 保留这些上下文。
- BULK-EMAIL-P0-04：`email_body` 必须由 `generated_prompt` 生成英文邮件正文，不能是固定模板或“下一步动作说明”；更换目的、产品或写手时，Prompt 和正文应体现差异。
- NURTURE-DETAIL-P0-09：`draft_content` 必须是完整可发送英文邮件草稿，包含 greeting、客户背景/需求、资料或产品价值、合规边界、CTA 和 sign-off；不得只是“将使用某写手风格/接下来发送资料”的动作摘要。
- NURTURE-DETAIL-P0-10：打开草稿详情时如发现历史旧草稿属于动作摘要或缺少 CTA/落款等完整邮件结构，后端必须自动替换为完整英文邮件草稿；由 `test_nurture_detail_replaces_legacy_action_summary_with_sendable_email` 和 `test_nurture_detail_replaces_incomplete_draft_with_sendable_email` 验证。
- NURTURE-DETAIL-P0-09：设置页填写的模型 API Key 必须可被服务端模型调用复用，但 `/api/settings/ai-model` 响应不得回显明文 Key 或服务端密钥字段。

## 2026-07-02 英文模板实现门禁记录
- 后端专项：`py -m pytest .\tests\test_api_contract.py -q -k "nurture or ai_model_library"` 通过，9 passed。
- 全量后端：`py -m pytest .\tests -q` 通过，110 passed。
- 前端构建：`npm.cmd run build` 通过；保留既有 Vite chunk size warning。

## 2026-07-02 邮件写手角色返修门禁
- NURTURE-DETAIL-P0-11：草稿详情展示邮件目的标签/字段，保存或重新生成后 `prompt_context_snapshot.email_purpose` 与页面当前值一致。
- NURTURE-DETAIL-P0-12：切换邮件写手角色后必须重新生成草稿，`draft_content`、`writer_role_key` 和角色定义快照同步变化，不得沿用旧写手模板。
- NURTURE-DETAIL-P0-13：重新生成上下文必须包含写手能力与技能方向、角色目标、相关技能、背景定义和角色标签；接口返回不依赖中文名。
- NURTURE-DETAIL-P0-14：重新生成上下文必须包含写手后台执行提示词 `prompt_directive`；同一客户切换 `ReplyMirror`、`Mario`、`Baymax` 等写手时，返回正文必须体现不同角色的结构和语气差异。

## 2026-07-03 群发邮件附件解析 TDD
- BULK-EMAIL-P0-05：群发邮件参考附件上传必须调用后端解析接口，PDF、Word、Excel 返回 `extracted_text`；创建群发草稿时 `prompt_context_snapshot.rendered_prompt` 必须包含附件正文，前端附件标签显示“已解析正文/仅元数据”。