# 页面 TDD：阶段1_客户池_客户池列表

## 来源
- 功能文档：`output/pages/阶段1_客户池_客户池列表.md`
- 原型蓝图：`output/pages/阶段1_客户池_客户池列表.html`
- 聚合门禁：`tests/integration/接口契约_TDD.md`、`tests/e2e/MVP业务闭环_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-CUSTOMERS-01 | P0 | 客户池存在不同状态客户 | 打开客户池列表 | 列表按高意向、有效跟进、资料库、已转代理商、无效、撤单/流失等状态筛选并分页 | 状态不完整会混淆客户资产 |
| PAGE-CUSTOMERS-02 | P0 | 销售角色访问客户池 | 请求列表 API | 仅返回分配给该销售或授权范围内客户 | 销售看到全量客户会违反数据隔离 |
| PAGE-CUSTOMERS-03 | P0 | 运营点击客户行详情 | 跳转客户详情 | 使用真实 customer id 打开详情，历史线索和反馈可查 | 静态跳转无法支撑长期档案 |
| PAGE-CUSTOMERS-04 | P1 | 筛选国家/产品/状态组合 | 请求列表 | 后端组合条件查询，返回总数和当前页，不全量下放前端 | 前端过滤会破坏分页准确性 |
| PAGE-CUSTOMERS-05 | P2 | 客户列表为空 | 渲染空态 | 展示导入线索或返回线索池入口 | 空白页不能指导运营下一步 |
| PAGE-CUSTOMERS-06 | P0 | 用户打开客户池列表 | 查看页面主操作 | 页头不出现“确认当前视图”类无业务按钮，不出现再营销待办入口；再营销任务统一在再营销模块处理 | 跨模块入口会让客户池职责混乱 |

## 当前落地映射（06-30-2026）
- 后端接口：`GET /api/customers` 支持 `page`、`page_size`、`country`、`product`、`tier`，在数据库查询层组合过滤并返回 `total`、客户池指标、当前页列表和空态动作。
- 数据隔离：销售角色由后端强制追加 `Customer.owner_id == current_user.id`，管理员/运营可看全局。
- 前端路由：`/admin/customers` 渲染真实客户池列表，包含全局 Banner、4 个指标卡、筛选控件、客户表和真实 `detail_path` 详情跳转；不展示客户摘要卡片、再营销草稿入口或无业务含义的确认按钮。
- 当前自动化验证：`py -m pytest .\tests -q -k customer_pool` 为 6 passed；后端全量 `py -m pytest .\tests -q` 为 36 passed；前端 `npm.cmd run build` 通过。
- 验收返修：客户池列表与客户详情相关 401/404/403 错误均返回结构化 `{code,message}`，覆盖未登录、客户不存在和客户详情越权。
- 浏览器验收：1440px 视口打开 `/admin/customers`，确认标题、Banner、4 指标、摘要/草稿、7 列表格、GlobalMed Peru 真实数据和 `/admin/customers/1` 详情跳转可用。
