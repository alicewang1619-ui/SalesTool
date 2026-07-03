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
| PAGE-SETTINGS-07 | P0 | 管理员管理 Banner | 上传并发布真实图片 | 普通 Banner 不显示“全局公告/查看详情”，设置页展示推荐尺寸和清晰错误；较长 data URL 可发布 | Banner 文案噪声和图片大小限制会造成误导和发布失败 |
| PAGE-SETTINGS-08 | P0 | 管理员管理 AI 模型 | 新增模型并绑定邮件草稿/客户背景调研 | overview 返回模型库、use_case_bindings，保存写审计；再营销草稿重生成使用邮件草稿绑定模型 | 单一默认模型无法覆盖不同 AI 任务 |
| PAGE-SETTINGS-09 | P1 | 管理员进入配置子页 | 点击产品知识库 | 页面头部展示返回设置中心按钮 | 缺返回路径会导致用户进入子配置后迷路 |


## 2. 生产化 TDD 映射（06-30-2026）
- `PAGE-SETTINGS-01` 映射为 `test_settings_overview_contains_entries_banner_accounts_and_permissions`：断言设置首页返回销售账号、角色权限、全局 Banner、国家映射、产品知识库、来源字典、渠道和提醒规则入口，并包含销售账号和权限矩阵数据。
- `PAGE-SETTINGS-02` 映射为 `test_settings_create_sales_user_persists_scope_role_and_audit`：断言管理员创建销售账号后可在销售账号列表查到，并写入 `settings_sales_user_created` 审计日志。
- `PAGE-SETTINGS-03` 映射为 `test_settings_publish_banner_updates_global_banner_and_audit`：断言 Banner 发布后 `/api/banner` 立即返回新 Banner，并写入 `settings_banner_published` 审计日志。
- `PAGE-SETTINGS-04` 映射为 `test_sales_user_cannot_access_settings_management`：断言销售角色访问设置 overview、创建账号和发布 Banner 均返回 403。
- `PAGE-SETTINGS-05` 映射为 `test_settings_save_permission_matrix_records_audit`：断言权限矩阵保存后 overview 读取到最新权限，并写入 `settings_permissions_updated` 审计日志。
- `PAGE-SETTINGS-06` 映射为 `test_settings_ai_model_config_can_be_saved_and_audited`：断言 overview 返回 AI 模型配置；保存默认模型后持久化并写入 `settings_ai_model_updated` 审计日志。
- 前端构建与页面运行需覆盖 `PAGE-SETTINGS-06` 的旧响应兼容：当本地旧 `overview` 暂无 `ai_model` 时，设置页仍展示 AI 与模型菜单和默认模型兜底，不允许出现 undefined 崩溃。
- `PAGE-SETTINGS-07` 映射为 `test_settings_publish_banner_accepts_recommended_large_data_url`，并由前端 `GlobalBanner` 组件检查兜底：普通 Banner 不渲染“全局公告/查看详情”。
- `PAGE-SETTINGS-08` 映射为 `test_settings_ai_model_library_bindings_can_be_saved_and_used_by_nurture_regeneration`：断言可新增模型选项、保存邮件草稿/客户背景调研绑定，并在再营销重生成时写入绑定模型供应商和版本。
- `PAGE-SETTINGS-09` 映射到前端构建与页面检查：`ProductKnowledgePage` 头部提供返回设置中心入口。
- 当前门禁：设置管理专项 `py -m pytest .\tests -q -k settings` 为 12 passed；后端全量 `py -m pytest .\tests -q` 为 99 passed；前端 `npm.cmd run build` 通过；保留既有 deprecation warnings 和 Vite chunk size warning。

## 2026-07-01 追加验收：AI 场景与邮件写手

| 编号 | 优先级 | 前置 | 操作 | 期望 |
|---|---|---|---|---|
| SETTINGS-AI-ROLE-01 | P0 | 管理员进入设置页 AI 与模型 | 新增大模型、添加“邮件草稿写作”之外的新场景并绑定模型 | 配置保存成功，场景和绑定从接口返回，不依赖前端写死 |
| SETTINGS-AI-ROLE-02 | P0 | 管理员进入设置页 AI 与模型 | 新增或编辑邮件写手角色的风格和技能 | 保存成功，邮件写手列表返回 Doraemon、Mario、Pikachu、Totoro、Baymax、Nemo 及用户新增/修改项 |
| SETTINGS-AI-ROLE-03 | P0 | 打开再营销草稿详情 | 选择邮件写手角色并重新生成草稿 | NurtureTask 保存 writer_role_key，prompt_context_snapshot 包含角色风格和技能 |

### 追加验收结果
- 后端新增契约：`test_settings_ai_model_scenarios_and_email_writers_can_be_saved` 已通过，覆盖新增场景、场景绑定、邮件写手角色和 `/api/ai/email-writers`。
- 专项门禁：`py -m pytest .\tests -q -k "settings or nurture"` 为 19 passed、82 deselected。
- 全量门禁：`py -m pytest .\tests -q` 为 101 passed；前端 `npm.cmd run build` 通过。
## 2026-07-01 二次统一返修 TDD
- 设置中心必须提供邮件接口配置，保存后返回主邮箱、发件人、SMTP/服务接口摘要、启用状态和测试结果，并写入审计。
- 客户来源字典、渠道配置、提醒规则必须可新增、编辑、启停和保存；客户来源字典变化后驱动线索池来源筛选和导入校验。
- 发布全局 Banner 后，`GET /api/banner` 立即返回新标题/正文/图片，普通页面刷新后显示新 Banner。

## 2026-07-01 三次统一返修 TDD
| 编号 | 优先级 | 场景 | 验收标准 |
|---|---|---|---|
| SETTINGS-MAIL-LABEL-01 | P0 | 管理员打开邮件接口配置 | 每个输入项都有可见字段标题，不能只靠 placeholder 说明 |
| SETTINGS-AI-SCENE-01 | P0 | 管理员配置 AI 场景 | 页面先选择场景，再为该场景选择模型；可新增场景并保存后从接口返回 |
| SETTINGS-AI-MODEL-API-01 | P0 | 管理员新增大模型 | 表单包含模型 Key、供应商、API Base URL、Endpoint、鉴权方式、API Key 配置状态、启用状态；后端保存后不明文回显 API Key |
| SETTINGS-AI-COLLAPSE-01 | P1 | 打开 AI 与模型页 | 模型库和邮件写手默认不全量铺开，通过下拉/折叠/弹窗查看详情 |
| SETTINGS-WRITER-MODAL-01 | P0 | 编辑邮件写手角色 | 点击角色后打开弹窗，按纵向表单编辑风格、技能、适用场景并保存 |
| LOGIN-SHELL-01 | P0 | 未登录访问登录页 | 不出现后台左侧菜单、后台 Banner 和后台业务导航 |
| APP-SHELL-FIXED-01 | P1 | 后台页面滚动 | 左侧菜单固定在视口，主内容滚动不带动菜单滚动 |
| DETAIL-BACK-01 | P1 | 打开再营销/客户/线索详情 | 顶部页头提供返回列表或返回上一页按钮 |
| SOURCE-DICT-COLLAPSE-01 | P0 | 配置客户来源字典 | 默认仅显示来源类型摘要，选择/展开类型后才能编辑该组来源并保存 |

## 2026-07-01 三次统一返修实现回写
- 已实现邮件接口字段标题：发信邮箱、发件人名称、SMTP Host、SMTP Port、SMTP 用户名、SMTP 密码/应用专用密码、测试收件人邮箱均有可见标签。
- 已实现 AI 场景优先配置：设置页先选择模型场景，再为场景绑定模型；新增场景使用弹窗；模型库通过下拉选择和弹窗编辑，不再全量表格铺开。
- 已实现大模型 API 配置字段：模型 Key、名称、供应商、API Base URL、Endpoint Path、鉴权方式、API Key 配置状态、启用状态；后端保存 API Key 配置状态但不在响应中回显明文 API Key。
- 已实现邮件写手下拉/弹窗：默认写手和当前编辑写手通过下拉选择，点击编辑打开纵向表单配置英文角色、中文名、风格、技能、适用场景和状态。
- 已实现独立登录页：未登录状态只展示登录卡片和产品说明，不展示后台左侧菜单或全局后台 Banner。
- 已实现后台布局固定：左侧菜单固定 100vh，主内容区域独立滚动；现有线索详情、客户详情、再营销详情、产品知识库和国家销售映射均保留返回按钮。
- 已实现客户来源字典下拉维护：先选择来源类型，再只展示该类型下来源项，支持当前类型新增、编辑、启停和保存。
- 验证：frontend 执行 `npm.cmd run build` 通过；backend 设置专项执行 `py -m pytest .\tests -q -k "settings_ai_model_library_bindings_can_be_saved_and_used_by_nurture_regeneration or settings_ai_model_scenarios_and_email_writers_can_be_saved or settings"` 结果 15 passed；backend 全量执行 `py -m pytest .\tests -q` 结果 103 passed。

## 2026-07-02 二次返修补充
- 工作台首页只保留筛选、可跳转指标卡和继续处理快捷入口；不得再展示底部 AI 摘要、分发与反馈或客户/线索明细表。
- 待分配确认时管理员/运营只选择销售并点击确认；分配后系统态显示“已分配 / 待销售反馈”，该状态不属于销售反馈状态选项，客户需立即从待分配列表移除。
- 客户来源字典必须支持新增、编辑、启用/停用和删除式操作；已被历史引用的来源不硬删除，采用停用方式从筛选和导入校验中移除。
- 产品知识库需要支持产品、竞品、市场以及自定义知识库板块；自定义板块可新增、重命名和删除，仍有知识条目的板块不得静默删除。
- 群发邮件放在“再营销 / 群发邮件”，仅管理员和运营可见；群发目的包含“开发信、活动推广、自定义类型”，选择后自动带出主题模板、正文模板和生成 Prompt，并允许选择邮件写手和上传 PDF/Word/Excel 参考附件。
- 群发邮件第一版只创建草稿/模板/预览和审计记录，不绕过人工确认直接发送；真正发送依赖邮箱接口配置成功后的人工确认流程。
- 再营销页面内蓝色说明框改为悬浮提示/说明按钮，减少页面铺满说明文本；单客户附件支持 PDF、Word、Excel。
## 2026-07-02 邮件写手角色 UI 验收
- SETTINGS-WRITER-UI-01：邮件写手下拉选项和选中态只显示英文角色名，不拼接风格、技能或标签。
- SETTINGS-WRITER-UI-02：鼠标悬停或点击角色名时可查看角色目标、能力方向、技能、背景定义和标签。
- SETTINGS-WRITER-UI-03：邮件写手卡片顶部不展示“编辑所选角色/删除所选角色”，选中角色详情卡片底部展示“编辑”“删除”。

## 2026-07-03 营销技能菜单验收
- SETTINGS-MARKETING-SKILL-01：左侧主导航展示“营销技能”，管理员/运营点击后直接进入邮件写手配置独立页；页面不展示“配置中心”标题、配置中心说明、顶部配置 Tab、总览卡片或其他配置入口。
- SETTINGS-MARKETING-SKILL-02：AI 与模型 Tab 只包含场景模型绑定、大模型连接配置和产品/AI 配置入口，不渲染“邮件写手角色”卡片。
- SETTINGS-MARKETING-SKILL-03：邮件写手配置页左侧可选择默认写手、当前编辑写手，并展示写手列表；右侧详情卡可查看角色目标、能力方向、适用场景、背景定义、执行提示词、技能标签和编辑/删除按钮。
- SETTINGS-MARKETING-SKILL-04：URL 为 `section=marketing` 时左侧高亮“营销技能”，内容区只展示写手配置独立视图；销售账号看不到该入口。

## 2026-07-02 大模型连接配置 UI 验收
- SETTINGS-MODEL-UI-01：大模型连接配置卡片顶部只展示“添加大模型”“保存模型库”，不展示“编辑所选模型/删除所选模型”。
- SETTINGS-MODEL-UI-02：选中模型详情卡片底部展示“编辑”“删除”，点击编辑打开当前模型弹窗，点击删除走现有二次确认和绑定回退逻辑。

## 2026-07-02 信息型蓝框清理验收
- SETTINGS-INFO-UI-01：设置总览、Banner 建议、客户来源维护说明、邮件接口用途和 AI 场景说明不使用蓝色 `info` Alert。
- SETTINGS-INFO-UI-02：设置页仍允许 success/error/warning 状态提示；普通说明改为灰色辅助文案或控件旁提示。
