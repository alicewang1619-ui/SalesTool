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

## 2026-07-02 二次返修补充
- 工作台首页只保留筛选、可跳转指标卡和继续处理快捷入口；不得再展示底部 AI 摘要、分发与反馈或客户/线索明细表。
- 待分配确认时管理员/运营只选择销售并点击确认；分配后系统态显示“已分配 / 待销售反馈”，该状态不属于销售反馈状态选项，客户需立即从待分配列表移除。
- 客户来源字典必须支持新增、编辑、启用/停用和删除式操作；已被历史引用的来源不硬删除，采用停用方式从筛选和导入校验中移除。
- 产品知识库需要支持产品、竞品、市场以及自定义知识库板块；自定义板块可新增、重命名和删除，仍有知识条目的板块不得静默删除。
- 群发邮件放在“再营销 / 群发邮件”，仅管理员和运营可见；群发目的包含“开发信、活动推广、自定义类型”，选择后自动带出主题模板、正文模板和生成 Prompt，并允许选择邮件写手和上传 PDF/Word/Excel 参考附件。
- 群发邮件第一版只创建草稿/模板/预览和审计记录，不绕过人工确认直接发送；真正发送依赖邮箱接口配置成功后的人工确认流程。
- 再营销页面内蓝色说明框改为悬浮提示/说明按钮，减少页面铺满说明文本；单客户附件支持 PDF、Word、Excel。
