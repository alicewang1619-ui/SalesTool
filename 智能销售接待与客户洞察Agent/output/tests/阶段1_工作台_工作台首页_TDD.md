# 页面 TDD：阶段1_工作台_工作台首页

## 来源
- 功能文档：`output/pages/阶段1_工作台_工作台首页.md`
- 原型蓝图：`output/pages/阶段1_工作台_工作台首页.html`
- 聚合门禁：`tests/e2e/MVP业务闭环_TDD.md`、`tests/component/后台页面组件_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-DASH-01 | P0 | 管理员已登录且存在真实线索/客户/反馈数据 | 打开工作台 | 顶部固定 Banner、指标卡和待办表格按原型结构展示，数字来自后端聚合接口 | 使用静态数字会无法反映真实业务 |
| PAGE-DASH-02 | P0 | 今日询盘、有效线索、未反馈、官网 KPI 有数据 | 请求工作台 API | 后端按权限返回分页/聚合结果，前端各卡片与接口结果一致 | 前端自行计算或全量查询会导致性能和权限风险 |
| PAGE-DASH-03 | P1 | 用户点击待办行查看详情 | 从工作台进入下游页面 | 路由携带真实记录 id，并打开对应线索/客户/再营销任务 | 假按钮或无 id 跳转无法支撑闭环 |
| PAGE-DASH-04 | P1 | 工作台接口失败 | 页面加载 | 展示失败原因和重试入口，结构化日志记录 trace id | 只显示空白会让运营无法定位问题 |
| PAGE-DASH-05 | P2 | 1366px 与 390px 视口 | 渲染工作台 | 指标卡、Banner、表格无重叠和横向溢出 | 原型复刻不做响应式会破坏移动查看 |
| PAGE-DASH-06 | P0 | 后端短暂返回旧版本或缺省 `time_scope` / `metric_links` / `assignment_timeline` | 打开工作台 | 页面不崩溃；时间范围显示“全部历史”；指标卡使用 fallback 跳转；时间线为空数组渲染 | 前后端发布不同步会导致整页白屏 |

## 当前自动化落地（06-30-2026）
- 已在 `backend/tests/test_api_contract.py` 增加工作台契约测试：未登录访问 `/api/dashboard` 返回 401；管理员获取后端聚合指标和分页待办；销售账号仅能看到自己负责的线索。
- 已实现 `GET /api/dashboard`，前端工作台只消费该聚合接口，不再本地计算指标。
- 当前验证结果：后端 `py -m pytest .\tests -q` 为 10 passed；前端 `npm.cmd run build` 通过。

## 浏览器复核补充（06-30-2026）

### 返修门禁补充（06-30-2026）
- 新增后端契约用例 `test_dashboard_filters_and_pagination_are_backend_driven`：用真实种子线索字段反查 `GET /api/dashboard`，要求来源、国家、客户类型、产品筛选在后端生效，并验证 `page/page_size` 返回不同页记录。
- 新增后端契约用例 `test_dashboard_view_is_audited_with_trace_id`：访问工作台后，`GET /api/audit-logs` 必须能看到 `dashboard_viewed`，且带 trace id。
- 前端验收补充：工作台筛选控件必须包含来源、国家、客户类型、产品、销售、周期；“应用/确认”必须触发真实查询，“导入线索”必须进入 `/admin/leads?intent=import`，“查看详情”必须进入携带真实 `recordId` 的路径。
- 当前验证结果：`py -m pytest .\tests -q` 为 12 passed；`npm.cmd run build` 通过；浏览器实测登录后工作台无横向溢出，导入入口进入线索池导入意图路径，详情入口进入 `/admin/leads?recordId=2`；标准库 HTTP 验证来源字典“邮箱”筛选返回 1 条 Al Noor Hospital。
- 真实浏览器发现成功加载数据后仍可能残留旧错误条，已要求工作台页在 `fetchDashboard()` 成功后同步清空错误状态。
- 响应式复核覆盖 1366px 与 390px：全局 Banner、四个指标卡、待办表格动作可见，页面级 `scrollWidth <= clientWidth`。
- “查看详情”复核要求点击后 URL 必须携带真实记录 id，例如 `/admin/leads?recordId=2`。

## 07-01-2026 运行时错误回归用例
- 用户在预览环境打开 `/admin/dashboard` 时曾触发 `Cannot read properties of undefined (reading 'label')`，堆栈指向 `DashboardPage`。
- 前端必须使用 `dashboard?.time_scope?.label` 等二级空值保护，不允许只判断 `dashboard` 后直接读取 `time_scope.label`。
- 构建验收之外，需要在浏览器预览中确认 `/admin/dashboard` 不再出现 React Router 的 `Unexpected Application Error` 页面。
