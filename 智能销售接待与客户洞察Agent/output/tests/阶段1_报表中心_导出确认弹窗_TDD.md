# 页面 TDD：阶段1_报表中心_导出确认弹窗

## 来源
- 功能文档：`output/pages/阶段1_报表中心_导出确认弹窗.md`
- 原型蓝图：`output/pages/阶段1_报表中心_导出确认弹窗.html`
- 聚合门禁：`tests/crosscut/安全鉴权_TDD.md`、`tests/integration/接口契约_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-EXPORT-01 | P0 | 有导出权限用户点击导出 | 打开确认弹窗 | 弹窗展示导出周期、字段、脱敏策略和不含成交/报价金额说明 | 直接导出会绕过风险确认 |
| PAGE-EXPORT-02 | P0 | 用户确认导出 | 调用导出 API | 后端生成导出任务、写审计日志并返回任务 id | 前端下载静态文件无法审计 |
| PAGE-EXPORT-03 | P0 | 无导出权限用户点击导出 API | 直接请求接口 | API 返回 403，不生成任务 | 只隐藏按钮不能防越权 |
| PAGE-EXPORT-04 | P1 | 导出字段包含敏感信息 | 确认导出 | 后端按权限脱敏，下载文件不含未授权字段 | 脱敏只在前端会被绕过 |
| PAGE-EXPORT-05 | P2 | 用户按 Esc 或点击取消 | 操作弹窗 | 焦点返回触发按钮，不产生导出任务 | 弹窗无焦点管理会影响可用性 |


## 2. 生产化 TDD 映射（06-30-2026）
- `PAGE-EXPORT-01` 映射为 `test_report_export_context_shows_confirmation_scope_fields_and_no_money`：断言确认上下文展示周期、筛选、字段、脱敏策略、预估行数，且字段不包含成交金额或报价金额。
- `PAGE-EXPORT-02` 映射为 `test_report_export_confirm_creates_task_and_audit`：断言确认导出创建持久化任务、返回 task_id/download_path，并写入 `report_export_created` 审计日志。
- `PAGE-EXPORT-03` 映射为 `test_sales_user_cannot_access_report_export`：断言销售角色访问导出上下文和创建导出任务均返回 403。
- `PAGE-EXPORT-04` 映射为 `test_report_export_download_is_desensitized_and_excludes_unauthorized_fields`：断言下载 CSV 包含真实客户数据，但不包含成交金额、报价金额、原始询盘字段或会话历史字段。
- `PAGE-EXPORT-05` 映射为 `test_report_export_context_does_not_create_task_until_confirmed`：断言只打开确认上下文不会写入 `report_export_created` 任务审计；前端浏览器补测 Esc 取消返回周期报表。
- 当前门禁：导出确认专项 `py -m pytest .\tests -q -k report_export` 为 5 passed；后端全量、前端构建和浏览器验收已随提交前复跑。

### 2.1 提交前复跑结果（06-30-2026）
- 导出确认专项：`py -m pytest .\tests -q -k report_export` 为 5 passed。
- 后端全量：`py -m pytest .\tests -q` 为 59 passed。
- 前端构建：`npm.cmd run build` 通过，保留既有 Vite chunk size warning 作为后续性能优化项。
- 浏览器验收：`/admin/reports/export?period=year&country=Peru` 主流程和 Esc 取消均通过，控制台 warning/error 为 0。
