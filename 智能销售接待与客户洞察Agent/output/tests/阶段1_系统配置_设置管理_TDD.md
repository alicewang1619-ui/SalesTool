# 页面 TDD：阶段1_系统配置_设置管理

## 来源
- 功能文档：`output/pages/阶段1_系统配置_设置管理.md`
- 原型蓝图：`output/pages/阶段1_系统配置_设置管理.html`
- 聚合门禁：`tests/crosscut/安全鉴权_TDD.md`、`tests/component/后台页面组件_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-SETTINGS-01 | P0 | 管理员进入设置管理 | 打开页面 | 展示销售账号、角色权限、全局 Banner、国家映射、产品知识库、来源字典、渠道和提醒规则入口 | 缺管理员页会无法配置账号与权限 |
| PAGE-SETTINGS-02 | P0 | 管理员新增销售账号并设置负责区域 | 保存账号 | 后端创建账号、角色和数据范围，刷新后可查，审计记录完整 | 只维护前端列表无法生效 |
| PAGE-SETTINGS-03 | P0 | 管理员上传并发布 Banner | 调用 Banner API | 图片持久化到对象存储/文件服务，所有后台页面顶部读取最新 Banner | 仅本页预览无法满足全站统一 |
| PAGE-SETTINGS-04 | P0 | 销售角色访问设置管理 | 请求页面/API | API 返回 403，页面显示无权限 | 普通销售进入配置会造成安全风险 |
| PAGE-SETTINGS-05 | P1 | 管理员修改权限矩阵 | 保存权限 | 菜单、按钮和接口权限同步生效，且写审计日志 | 只改 UI 不改接口会产生越权 |
| PAGE-SETTINGS-06 | P0 | 管理员进入设置管理 | 点击顶部菜单 | 下方只展示当前菜单对应设置域；AI 与模型菜单包含大模型选择并可保存审计 | 一屏堆叠全部配置会造成理解成本高，缺模型配置会阻断 AI 策略调整 |


## 2. 生产化 TDD 映射（06-30-2026）
- `PAGE-SETTINGS-01` 映射为 `test_settings_overview_contains_entries_banner_accounts_and_permissions`：断言设置首页返回销售账号、角色权限、全局 Banner、国家映射、产品知识库、来源字典、渠道和提醒规则入口，并包含销售账号和权限矩阵数据。
- `PAGE-SETTINGS-02` 映射为 `test_settings_create_sales_user_persists_scope_role_and_audit`：断言管理员创建销售账号后可在销售账号列表查到，并写入 `settings_sales_user_created` 审计日志。
- `PAGE-SETTINGS-03` 映射为 `test_settings_publish_banner_updates_global_banner_and_audit`：断言 Banner 发布后 `/api/banner` 立即返回新 Banner，并写入 `settings_banner_published` 审计日志。
- `PAGE-SETTINGS-04` 映射为 `test_sales_user_cannot_access_settings_management`：断言销售角色访问设置 overview、创建账号和发布 Banner 均返回 403。
- `PAGE-SETTINGS-05` 映射为 `test_settings_save_permission_matrix_records_audit`：断言权限矩阵保存后 overview 读取到最新权限，并写入 `settings_permissions_updated` 审计日志。
- `PAGE-SETTINGS-06` 映射为 `test_settings_ai_model_config_can_be_saved_and_audited`：断言 overview 返回 AI 模型配置；保存默认模型后持久化并写入 `settings_ai_model_updated` 审计日志。
- 前端构建与页面运行需覆盖 `PAGE-SETTINGS-06` 的旧响应兼容：当本地旧 `overview` 暂无 `ai_model` 时，设置页仍展示 AI 与模型菜单和默认模型兜底，不允许出现 undefined 崩溃。
- 当前门禁：设置管理专项 `py -m pytest .\tests -q -k settings` 为 5 passed；前端 `npm.cmd run build` 通过；Playwright 验证真实读写和控制台通过。
