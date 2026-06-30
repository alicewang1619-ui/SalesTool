# 页面 TDD：阶段1_系统配置_产品知识库

## 来源
- 功能文档：`output/pages/阶段1_系统配置_产品知识库.md`
- 原型蓝图：`output/pages/阶段1_系统配置_产品知识库.html`
- 聚合门禁：`tests/unit/核心领域规则_TDD.md`、`tests/crosscut/边界异常_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-KB-01 | P0 | 管理员进入产品知识库 | 打开页面 | 展示 ultrasound 产品类型、型号、应用场景和 AI 接待知识 | 产品知识缺失会影响线索评分和接待 |
| PAGE-KB-02 | P0 | 管理员新增或编辑产品知识 | 保存 | 后端持久化版本、状态和审计记录，AI 相关任务读取新版本 | 只改页面文本无法影响业务 |
| PAGE-KB-03 | P1 | 产品知识被停用 | 线索评分或接待调用 | 停用知识不参与新任务，历史记录保留旧版本引用 | 缺版本会导致历史不可追溯 |
| PAGE-KB-04 | P1 | 文本包含外部复制内容 | 保存并供 LLM 使用 | 调用 LLM 前以数据分隔符隔离，不当作系统指令 | Prompt 注入会污染接待输出 |
| PAGE-KB-05 | P2 | 名称过长或字段缺失 | 提交表单 | 返回字段级错误，不写入脏数据 | 表单弱校验会破坏知识库质量 |


## 生产化 TDD 映射补充（2026-06-30）

### 新增可执行契约

- `test_product_knowledge_overview_lists_products_versions_and_ai_guidance`：覆盖产品知识列表、版本、状态和 AI 接待知识字段。
- `test_product_knowledge_save_persists_version_audit_and_ai_context`：覆盖保存后持久化、自动版本、审计和 AI 上下文读取。
- `test_product_knowledge_disabled_items_are_kept_but_excluded_from_ai_context`：覆盖停用知识保留历史但不进入新 AI 上下文。
- `test_product_knowledge_prompt_injection_is_wrapped_as_reference_data`：覆盖 Prompt 注入文本只作为参考数据包裹在 `<product_knowledge>` 中。
- `test_product_knowledge_invalid_required_fields_are_rejected`：覆盖必填字段为空返回 422，避免脏数据写入。
- `test_sales_user_cannot_access_product_knowledge_settings`：覆盖销售角色禁访。

### 红绿记录

- 红灯：`py -m pytest .\tests -q -k product_knowledge` 为 6 failed、69 deselected；失败原因为 `/api/settings/product-knowledge` 与 `/api/ai/product-knowledge/context` 尚未实现返回 404。
- 绿灯：实现后同命令为 6 passed、69 deselected。
- 回归：后端全量 `py -m pytest .\tests -q` 为 75 passed；前端 `npm.cmd run build` 通过，保留既有 Vite chunk size warning。
- 浏览器：Playwright 打开 `/admin/settings/product-knowledge`，保存 BrowserSono 型号成功，AI 上下文读取新型号，`safety_boundary` 正确，控制台 warning/error 为 0。

### 门禁结论

- P0：产品知识列表、保存版本、AI 上下文读取、审计和销售禁访已转绿。
- P1：停用版本排除、Prompt 注入边界和字段校验已转绿。

### 独立复核状态

- GOAL 独立验收代理派生失败，工具返回 `agent thread limit reached`；当前无法取得独立验收官签字。
- 当前本地闭环证据：产品知识专项 `py -m pytest .\tests -q -k product_knowledge` 为 6 passed；后端全量 `py -m pytest .\tests -q` 为 75 passed；前端 `npm.cmd run build` 通过；Playwright 验证保存知识、AI 上下文读取和控制台质量通过；文档已同步。
