# 页面 TDD：阶段1_报表中心_周期报表视图

## 来源
- 功能文档：`output/pages/阶段1_报表中心_周期报表视图.md`
- 原型蓝图：`output/pages/阶段1_报表中心_周期报表视图.html`
- 聚合门禁：`tests/integration/接口契约_TDD.md`、`tests/crosscut/性能基线_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-REPORT-PERIOD-01 | P0 | 用户选择日/月/季/年周期 | 请求报表 API | 后端按周期、国家、渠道、产品、销售反馈聚合返回真实数据 | 周期口径错误会导致管理判断错误 |
| PAGE-REPORT-PERIOD-02 | P0 | 用户切换筛选条件 | 页面刷新数据 | 图表/表格与接口返回一致，不保留旧筛选缓存 | 缓存 key 缺少语义维度会命中旧结果 |
| PAGE-REPORT-PERIOD-03 | P1 | 点击指标明细 | 进入指标明细页 | 带上周期、维度和筛选条件 | 明细缺上下文会无法解释指标 |
| PAGE-REPORT-PERIOD-04 | P1 | 点击导出 | 打开导出确认弹窗 | 弹窗展示当前周期和脱敏说明 | 未二次确认会造成导出风险 |
| PAGE-REPORT-PERIOD-05 | P2 | 报表接口超时 | 加载页面 | 显示超时错误、trace id 和重试按钮 | 裸错误或空白页无法定位问题 |

## 生产化 TDD 映射（06-30-2026）

- 后端契约测试已新增 `test_report_period_aggregates_by_dimensions_and_excludes_money`，覆盖周期聚合、国家/渠道/产品/反馈拆分以及不返回成交金额、报价金额。
- 后端契约测试已新增 `test_report_period_filters_change_backend_results_and_cache_context`，覆盖筛选条件改变后端结果与 query 上下文，避免前端缓存旧筛选。
- 后端契约测试已新增 `test_report_period_downstream_paths_carry_period_dimension_and_filters`，覆盖指标明细和导出下游路径必须携带周期与筛选维度。
- 后端契约测试已新增 `test_report_period_timeout_returns_traceable_error`，覆盖超时结构化错误、`REPORT_PERIOD_TIMEOUT` 和 `x-trace-id`。
- 后端契约测试已新增 `test_sales_user_cannot_access_report_period`，覆盖销售角色不可访问周期报表视图。
- 当前门禁：周期报表专项 `py -m pytest .\tests -q -k report_period` 为 5 passed；后端全量 `py -m pytest .\tests -q` 为 48 passed；前端 `npm.cmd run build` 通过；浏览器验收已确认 `/admin/reports/period` 的 Banner、指标卡、维度拆分、筛选刷新、下游动作和非金额口径可见且无新增控制台错误。
