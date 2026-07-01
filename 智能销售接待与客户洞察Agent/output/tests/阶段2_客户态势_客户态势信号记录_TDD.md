# 阶段2_客户态势_客户态势信号记录 TDD

## 覆盖目标
- 生产路由：`/admin/customer-signals`
- 后端 API：`GET /api/customer-signals`、`POST /api/customer-signals`、`GET /api/customer-signals/context`
- 数据模型：`CustomerSignal`
- 页面职责：让管理员/营销运营分页查看、筛选并人工新增客户态势信号，所有信号绑定客户详情、来源证据、可信度和审计记录。

## P0 用例
| ID | 验收点 | 预期失败原因 | 可执行验证 |
|---|---|---|---|
| CUSTOMER-SIGNAL-P0-01 | 客户态势信号列表必须来自持久化 CustomerSignal，并支持分页与汇总指标 | 当前尚无 CustomerSignal 模型和 `/api/customer-signals` 接口 | `py -m pytest .\tests -q -k customer_signal` 中 `test_customer_signals_list_is_paginated_filterable_and_customer_bound` 通过 |
| CUSTOMER-SIGNAL-P0-02 | 销售角色不能访问全局客户态势信号页面/API | 当前若复用普通客户查询可能泄露全局客户态势 | `test_sales_user_cannot_access_customer_signals` 返回 403 且写 `permission_denied` 审计 |
| CUSTOMER-SIGNAL-P0-03 | 信号来源不得包含未授权社媒抓取，AI 上下文必须声明为数据而非指令 | 当前无专用上下文边界，容易把网页/邮件文本当指令 | `test_customer_signal_context_is_data_only_and_excludes_unauthorized_social_scrape` 通过 |

## P1 用例
| ID | 验收点 | 预期失败原因 | 可执行验证 |
|---|---|---|---|
| CUSTOMER-SIGNAL-P1-01 | 管理员/运营可人工新增信号，保存后列表和客户详情入口可追溯 | 当前无新增接口和审计动作 | `test_customer_signal_create_persists_and_writes_audit` 通过 |
| CUSTOMER-SIGNAL-P1-02 | 页面展示指标卡、筛选区、人工新增表单和信号表格 | 当前只有静态 HTML 原型，没有 React 生产页面 | Playwright 打开 `/admin/customer-signals`，可见全局 Banner、四个指标、来源/状态筛选、人工新增信号、查看客户详情 |
| CUSTOMER-SIGNAL-P1-03 | 表格动作进入真实客户详情路由 | 静态原型仍可能跳到 `.html` 或线索详情 | 点击“查看客户详情”进入 `/admin/customers/:customerId` |

## 当前门禁记录
- 红灯命令：`cd backend && py -m pytest .\tests -q -k customer_signal`，实现前 4 failed，失败点为 `/api/customer-signals` 和 context 接口 404。
- 后端专项：`cd backend && py -m pytest .\tests -q -k customer_signal` 已转绿，4 passed。
- 后端全量：`cd backend && py -m pytest .\tests -q` 已通过，91 passed。
- 前端页面：`frontend/src/pages/CustomerSignalsPage.tsx` 消费真实 `/api/customer-signals`、`/api/customer-signals/context` 和 `/api/customers`。
- 前端门禁：`cd frontend && npm.cmd run build` 已通过，保留既有 Vite chunk size warning。
- 浏览器门禁：Playwright 管理员登录访问 `/admin/customer-signals` 已通过，可见全局 Banner、`CUSTOMER_SIGNAL_DATA_ONLY`、GlobalMed Peru 信号列表；页面新增待复核信号、按状态筛选命中新增记录，并跳转 `/admin/customers/1` 查看客户背景调查；`/api/customer-signals` 与 `/api/customers/1` 返回 200/201，控制台 warning/error/pageerror 均为 0。
