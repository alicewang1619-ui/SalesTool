# 页面 TDD：阶段1_报表中心_指标明细

## 来源
- 功能文档：`output/pages/阶段1_报表中心_指标明细.md`
- 原型蓝图：`output/pages/阶段1_报表中心_指标明细.html`
- 聚合门禁：`tests/integration/接口契约_TDD.md`、`tests/crosscut/边界异常_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-METRIC-DETAIL-01 | P0 | 用户从周期报表进入官网 KPI 明细 | 请求明细 API | 展示官网渠道 KPI、未反馈、销售反馈和产品分类明细 | 明细缺失会无法追溯指标来源 |
| PAGE-METRIC-DETAIL-02 | P0 | 用户应用国家/渠道/产品筛选 | 查询数据 | 后端按条件分页返回明细记录和汇总 | 前端全量筛选会导致分页错误 |
| PAGE-METRIC-DETAIL-03 | P1 | 点击相关客户/线索 | 跳转详情 | 使用真实 id 打开客户或线索详情 | 无真实 id 会导致链路断开 |
| PAGE-METRIC-DETAIL-04 | P1 | 用户请求导出当前明细 | 打开导出弹窗 | 导出范围与当前筛选一致并提示脱敏 | 导出范围不一致会造成数据误用 |
| PAGE-METRIC-DETAIL-05 | P2 | 无该维度数据 | 渲染页面 | 展示空状态和返回周期报表入口 | 无数据空白不利于排查 |


## 2. 生产化 TDD 映射（06-30-2026）
- `PAGE-METRIC-DETAIL-01` 映射为 `test_report_metrics_detail_returns_kpi_feedback_product_and_unfeedback_details`：断言接口返回官网 KPI、未反馈、销售反馈、产品分类、渠道质量和非金额指标卡。
- `PAGE-METRIC-DETAIL-02` 映射为 `test_report_metrics_detail_filters_are_backend_paginated`：断言国家、渠道、产品、销售反馈筛选与分页由后端返回一致结果。
- `PAGE-METRIC-DETAIL-03` 映射为 `test_report_metrics_detail_rows_use_real_lead_and_customer_paths`：断言明细行携带真实 lead/customer id 与 `/admin/leads/{id}`、`/admin/customers/{id}` 下钻路径。
- `PAGE-METRIC-DETAIL-04` 映射为 `test_report_metrics_detail_export_context_matches_filters_and_masks_money`：断言导出上下文继承当前筛选，导出需要二次确认，并且响应文本不包含成交金额或报价金额字段。
- `PAGE-METRIC-DETAIL-05` 映射为 `test_report_metrics_detail_empty_state_returns_period_entry`：断言无数据筛选返回空态标题、说明和返回周期报表入口。
- 权限补充用例 `test_sales_user_cannot_access_report_metrics_detail`：销售角色访问 `/api/reports/metrics` 返回 403，防止越权查看全局报表。
- 当前门禁：指标明细专项 `py -m pytest .\tests -q -k report_metrics` 为 6 passed；全量后端、前端构建和浏览器验收需随本页提交前复跑并记录。

### 2.1 提交前复跑结果（06-30-2026）
- 指标明细专项：`py -m pytest .\tests -q -k report_metrics` 为 6 passed。
- 后端全量：`py -m pytest .\tests -q` 为 54 passed。
- 前端构建：`npm.cmd run build` 通过，保留既有 Vite chunk size warning 作为后续性能优化项。
- 浏览器验收：`/admin/reports/metrics?period=year&country=Peru` 可见真实 GlobalMed Peru 数据、统一 Banner、筛选、指标卡、表格下钻；控制台错误 0；不展示成交金额/报价金额。
