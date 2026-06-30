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
