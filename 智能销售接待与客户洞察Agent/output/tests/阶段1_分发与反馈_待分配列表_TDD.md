# 页面 TDD：阶段1_分发与反馈_待分配列表

## 来源
- 功能文档：`output/pages/阶段1_分发与反馈_待分配列表.md`
- 原型蓝图：`output/pages/阶段1_分发与反馈_待分配列表.html`
- 聚合门禁：`tests/e2e/MVP业务闭环_TDD.md`、`tests/crosscut/安全鉴权_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-ASSIGN-01 | P0 | 存在国家缺失、映射缺失或负责人缺失的线索 | 打开待分配列表 | 表格按原型列出客户、国家、类型、产品、评分、反馈、动作并分页 | 不分页或少列会影响分发效率 |
| PAGE-ASSIGN-02 | P0 | 管理员选择销售负责人 | 确认分配 | 后端事务写入 lead assignee、生成 7 天有效反馈链接并写审计 | 分配和链接生成分开写会产生半完成状态 |
| PAGE-ASSIGN-03 | P0 | 销售角色访问待分配列表 | 请求接口 | API 返回 403，页面显示无权限 | 销售可看全量待分配会泄露询盘 |
| PAGE-ASSIGN-04 | P1 | 国家映射不存在 | 点击配置入口 | 跳转国家区域销售映射并保留待处理国家 | 缺跳转会让异常无法闭环 |
| PAGE-ASSIGN-05 | P2 | 两个管理员同时分配同一线索 | 并发提交 | 只有一次分配成功，另一请求返回冲突错误 | 无幂等/锁会造成重复分发 |


## 当前可执行门禁补充（06-30-2026）
- PAGE-ASSIGN-01 已落成后端契约：`test_pending_assignments_list_unassigned_and_mapping_failures_with_pagination` 验证分页、字段完整、国家映射缺失原因和配置路径。
- PAGE-ASSIGN-02 已落成后端契约：`test_pending_assignment_confirm_writes_owner_feedback_link_and_audit` 验证事务写入负责人、7 天反馈链接、详情回读和审计日志。
- PAGE-ASSIGN-03 已落成后端契约：`test_sales_user_cannot_access_pending_assignments` 验证销售角色列表与确认分配均为 403。
- PAGE-ASSIGN-04 已通过列表字段覆盖：`configure_mapping_path` 必须携带 `section=country-sales` 与 `pending_country`。
- PAGE-ASSIGN-05 已落成后端契约：`test_pending_assignment_conflict_when_two_admins_assign_same_lead` 验证第二个管理员基于旧 `expected_owner_id` 提交时返回 409 `ASSIGNMENT_CONFLICT`。
- 前端门禁：`PendingAssignmentsPage` 必须消费真实 API、使用销售账号列表生成负责人下拉框、确认分配后刷新列表，并在无数据时提供导入线索入口。

## 独立复核返修门禁补充（06-30-2026）
- 新增契约：`test_pending_assignment_with_existing_owner_requires_expected_owner`。Given 线索已有负责人但国家映射缺失仍出现在待分配列表；When 使用旧 `expected_owner_id: null` 提交；Then 返回 409；When 使用列表返回的真实 `owner_id` 提交；Then 分配成功。
- 前端门禁补充：`PendingAssignmentsPage` 的 `confirmPendingAssignment` 必须传 `lead.owner_id` 作为 `expectedOwnerId`。

## 2026-07-02 二次返修补充
- 工作台首页只保留筛选、可跳转指标卡和继续处理快捷入口；不得再展示底部 AI 摘要、分发与反馈或客户/线索明细表。
- 待分配确认时管理员/运营只选择销售并点击确认；分配后系统态显示“已分配 / 待销售反馈”，该状态不属于销售反馈状态选项，客户需立即从待分配列表移除。
- 客户来源字典必须支持新增、编辑、启用/停用和删除式操作；已被历史引用的来源不硬删除，采用停用方式从筛选和导入校验中移除。
- 产品知识库需要支持产品、竞品、市场以及自定义知识库板块；自定义板块可新增、重命名和删除，仍有知识条目的板块不得静默删除。
- 群发邮件放在“再营销 / 群发邮件”，仅管理员和运营可见；群发目的包含“开发信、活动推广、自定义类型”，选择后自动带出主题模板、正文模板和生成 Prompt，并允许选择邮件写手和上传 PDF/Word/Excel 参考附件。
- 群发邮件第一版只创建草稿/模板/预览和审计记录，不绕过人工确认直接发送；真正发送依赖邮箱接口配置成功后的人工确认流程。
- 再营销页面内蓝色说明框改为悬浮提示/说明按钮，减少页面铺满说明文本；单客户附件支持 PDF、Word、Excel。
