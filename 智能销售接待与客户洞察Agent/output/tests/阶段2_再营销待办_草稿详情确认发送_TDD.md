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
