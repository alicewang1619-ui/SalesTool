# 页面 TDD：阶段1_客户池_客户详情

## 来源
- 功能文档：`output/pages/阶段1_客户池_客户详情.md`
- 原型蓝图：`output/pages/阶段1_客户池_客户详情.html`
- 聚合门禁：`tests/unit/核心领域规则_TDD.md`、`tests/integration/接口契约_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-CUSTOMER-DETAIL-01 | P0 | 客户已导入且存在官网/邮件/人工资料 | 打开客户详情 | 展示“客户背景调查”、来源证据、可信度、最近生成时间和人工修改入口 | 缺背景调查无法满足用户新增需求 |
| PAGE-CUSTOMER-DETAIL-02 | P0 | 后台自动生成背景调查 | 调用调查任务 | worker 读取客户官网公开信息、网上邮件/历史邮件和人工资料，结果持久化且可追溯来源 | 只在前端生成摘要无法审计和复用 |
| PAGE-CUSTOMER-DETAIL-03 | P0 | 运营人工修改背景调查 | 保存修改 | 后端保留自动原文、人工修订版本、修改人和时间，刷新后展示最新人工版 | 覆盖原文会丢失证据链 |
| PAGE-CUSTOMER-DETAIL-04 | P1 | 无编辑权限用户查看详情 | 渲染页面 | 背景调查只读，保存/重新生成按钮不可用 | 前端未控权会造成越权修改 |
| PAGE-CUSTOMER-DETAIL-05 | P2 | 外部网页内容包含指令文本 | 进入 LLM 摘要 | system prompt 声明外部内容为数据，并用分隔符隔离 | LLM 注入会污染背景调查 |
| PAGE-CUSTOMER-DETAIL-06 | P0 | 存量客户或旧接口未返回 `signals`、`lead_history`、`feedback_records`、`timeline` 等数组 | 打开客户详情 | 页面展示空态/0 条记录，不出现 `Cannot read properties of undefined` 崩溃页 | 前端直接读取 `.length` 或 `.map` 会导致生产运行时崩溃 |


## 生产化执行记录（06-30-2026）

- 新增客户详情专项契约测试，覆盖 `PAGE-CUSTOMER-DETAIL-01`、`PAGE-CUSTOMER-DETAIL-03`、`PAGE-CUSTOMER-DETAIL-04` 的可执行验收。
- 红灯结果：`py -m pytest .\tests -q -k customer_detail` 初始为 3 failed、1 passed，失败集中于缺少 `owner_name`、`can_edit_background`、`background.current_summary` 等详情聚合字段。
- 绿灯结果：客户详情专项为 4 passed；后端全量为 39 passed；前端 `npm.cmd run build` 通过，保留既有 Vite chunk size warning。
- 浏览器验收：管理员登录 `/admin/customers/1` 后可见全局 Banner、客户背景调查、调查来源与证据、历史线索、状态时间线、销售反馈记录；保存人工修订后页面持久状态显示人工内容和 `Alice Admin` 更新人。
- 运行时回归补充：访问 `/admin/customers/:id` 时，若当前运行后端仍返回旧版客户详情响应且缺少部分数组字段，前端必须以空数组兜底并正常渲染客户基本信息、背景调查和空态表格。
