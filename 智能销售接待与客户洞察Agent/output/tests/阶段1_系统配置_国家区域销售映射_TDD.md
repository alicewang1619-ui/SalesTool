# 页面 TDD：阶段1_系统配置_国家区域销售映射

## 来源
- 功能文档：`output/pages/阶段1_系统配置_国家区域销售映射.md`
- 原型蓝图：`output/pages/阶段1_系统配置_国家区域销售映射.html`
- 聚合门禁：`tests/unit/核心领域规则_TDD.md`、`tests/integration/接口契约_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-REGION-01 | P0 | 管理员查看国家映射 | 打开页面 | 分页展示国家、区域、负责人、状态和更新时间 | 缺映射列表会导致分发无依据 |
| PAGE-REGION-02 | P0 | 管理员保存国家负责人 | 提交表单 | 后端校验国家唯一性并写入映射，待分配列表立即可使用 | 无唯一性会导致自动分发不确定 |
| PAGE-REGION-03 | P0 | 线索国家无映射 | 执行分发规则 | 线索进入待分配队列并提示缺映射 | 静默默认负责人会造成错分配 |
| PAGE-REGION-04 | P1 | 禁用某销售账号 | 查看映射 | 相关国家显示风险提示，不能继续分配给停用账号 | 账号状态不联动会分给无效销售 |
| PAGE-REGION-05 | P2 | 批量导入映射失败部分行 | 提交导入 | 成功行持久化，失败行返回原因和行号 | 全部失败或静默忽略会影响配置效率 |


## 生产化 TDD 映射补充（2026-06-30）

### 新增可执行契约

- `test_country_sales_mapping_overview_lists_rules_sales_and_pending`：覆盖 `GET /api/settings/country-sales` 聚合映射列表、销售选项、Peru 默认 `Latam / Maria Chen`、缺映射待分配预览。
- `test_country_sales_mapping_save_is_unique_and_audited`：覆盖同一国家 upsert 唯一保存、区域更新、列表回读和 `settings_country_sales_mapping_saved` 审计。
- `test_country_sales_mapping_feeds_pending_assignment_suggestion`：覆盖缺映射线索保存映射后，待分配接口移除 `COUNTRY_MAPPING_MISSING` 并返回建议负责人。
- `test_country_sales_mapping_disabled_sales_owner_is_risky_and_rejected`：覆盖停用销售映射风险标签，以及保存时拒绝停用销售账号。
- `test_sales_user_cannot_access_country_sales_mapping_settings`：覆盖销售角色访问国家映射设置页接口返回 403。

### 红绿记录

- 红灯：`py -m pytest .\tests -q -k country_sales_mapping` 为 5 failed、64 deselected；失败原因为 `/api/settings/country-sales` 未实现返回 404，待分配配置入口仍指向旧 query 路径。
- 绿灯：实现后同命令为 5 passed、64 deselected。
- 回归：`py -m pytest .\tests -q` 为 69 passed；`npm.cmd run build` 通过，保留既有 Vite chunk size warning。
- 浏览器：Playwright 打开 `/admin/settings/country-sales?pending_country=Browserland`，保存 `Browserland / Browser Region / Maria Chen` 成功，API 回读一致，控制台 warning/error 为 0。

### 门禁结论

- P0：国家映射列表、唯一保存、待分配联动、销售禁访已转绿。
- P1：停用销售风险提示与拒绝保存已转绿。
- P2：批量导入映射仍保留为后续增强，本轮未实现。

### 独立复核状态

- 已按 GOAL 要求尝试派生独立 explorer 复核本页，但工具返回 `agent thread limit reached`；本页暂无法取得独立验收官签字。
- 当前交付证据以专项 5 passed、后端全量 69 passed、前端构建、Playwright 浏览器验收和文档同步为准。
