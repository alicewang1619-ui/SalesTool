# 阶段2_再营销待办_再营销待办列表 TDD

## 覆盖目标
- 生产路由：`/admin/nurture`
- 后端 API：`GET /api/nurture-tasks`
- 数据模型：`NurtureTask`
- 页面职责：让运营从客户池中选择适合下一步触达的客户，查看建议下一步动作、客户备注、提示词/附件状态和草稿状态。

## P0 用例
| ID | 验收点 | 可执行验证 |
|---|---|---|
| NURTURE-LIST-P0-01 | 列表必须分页读取真实 NurtureTask，不得使用静态草稿数据 | `py -m pytest .\tests -q -k nurture` 中 `test_nurture_tasks_list_uses_persistent_prompt_context_and_pagination` 通过 |
| NURTURE-LIST-P0-02 | 每行必须展示建议下一步动作在客户备注之前，帮助运营选择客户 | Playwright 打开 `/admin/nurture` 可见“建议下一步动作”“客户备注”两列 |
| NURTURE-LIST-P0-03 | 提示词和附件状态来自后端任务字段 | API 返回 `generation_prompt`、`attachments`，页面展示提示词/附件标签 |
| NURTURE-LIST-P0-04 | 销售角色不能访问再营销队列 | `test_sales_user_cannot_access_nurture_tasks` 返回 403 |

## P1 用例
| ID | 验收点 | 可执行验证 |
|---|---|---|
| NURTURE-LIST-P1-01 | 入口按钮跳转真实草稿详情路由 | 行操作进入 `/admin/nurture/:taskId` |
| NURTURE-LIST-P1-02 | 空态提供返回客户池入口 | API total=0 时显示空态和 `/admin/customers` 动作 |

## 当前门禁记录
- 后端专项：`py -m pytest .\tests -q -k nurture` 已转绿，5 passed。
- 前端页面：`frontend/src/pages/NurtureTasksPage.tsx` 消费真实 API。
- 浏览器验收：Playwright 以管理员进入 `/admin/nurture`，确认统一 Banner、再营销待办列表、建议下一步动作、客户备注、提示词/附件和“查看草稿”入口可见；`/api/nurture-tasks` 响应 200，控制台 warning/error 为 0。
