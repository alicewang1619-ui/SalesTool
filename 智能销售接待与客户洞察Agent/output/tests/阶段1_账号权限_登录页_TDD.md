# 页面 TDD：阶段1_账号权限_登录页

## 来源
- 功能文档：`output/pages/阶段1_账号权限_登录页.md`
- 原型蓝图：`output/pages/阶段1_账号权限_登录页.html`
- 聚合门禁：`tests/crosscut/安全鉴权_TDD.md`、`tests/component/后台页面组件_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-LOGIN-01 | P0 | 未登录用户访问任一后台路由 | 打开登录页 | 页面按原型展示账号、密码、登录按钮和错误提示区域，且不出现后台业务数据 | 未做鉴权拦截会泄露后台页面 |
| PAGE-LOGIN-02 | P0 | 用户提交有效账号密码 | 调用真实登录 API | 后端返回会话、角色和权限，前端跳转工作台，并可用接口查询当前用户 | 只做前端跳转或硬编码用户无法证明真实登录 |
| PAGE-LOGIN-03 | P0 | 用户连续输入错误密码 | 连续提交超过限制 | API 返回结构化错误并触发限流/锁定，审计日志记录 trace id | 登录入口无限重试会造成暴力破解风险 |
| PAGE-LOGIN-04 | P1 | 会话过期用户访问后台 | 刷新页面 | 被重定向登录页，保留过期原因提示，不静默使用旧 token | 会话过期未处理会导致权限状态混乱 |
| PAGE-LOGIN-05 | P2 | 键盘用户进入页面 | Tab/Enter 操作登录表单 | 焦点顺序、错误 aria 描述和回车提交均可用 | 只验证渲染会漏掉无障碍阻断 |


## 2026-07-01 三次统一返修 TDD
- LOGIN-SHELL-01：未登录访问登录页时，不得渲染后台左侧菜单、后台 Banner 或后台业务导航；登录卡片应独立展示账号、密码、提交和错误提示。


## 2026-07-01 三次统一返修实现回写
- 已实现邮件接口字段标题：发信邮箱、发件人名称、SMTP Host、SMTP Port、SMTP 用户名、SMTP 密码/应用专用密码、测试收件人邮箱均有可见标签。
- 已实现 AI 场景优先配置：设置页先选择模型场景，再为场景绑定模型；新增场景使用弹窗；模型库通过下拉选择和弹窗编辑，不再全量表格铺开。
- 已实现大模型 API 配置字段：模型 Key、名称、供应商、API Base URL、Endpoint Path、鉴权方式、API Key 配置状态、启用状态；后端保存 API Key 配置状态但不在响应中回显明文 API Key。
- 已实现邮件写手下拉/弹窗：默认写手和当前编辑写手通过下拉选择，点击编辑打开纵向表单配置英文角色、中文名、风格、技能、适用场景和状态。
- 已实现独立登录页：未登录状态只展示登录卡片和产品说明，不展示后台左侧菜单或全局后台 Banner。
- 已实现后台布局固定：左侧菜单固定 100vh，主内容区域独立滚动；现有线索详情、客户详情、再营销详情、产品知识库和国家销售映射均保留返回按钮。
- 已实现客户来源字典下拉维护：先选择来源类型，再只展示该类型下来源项，支持当前类型新增、编辑、启停和保存。
- 验证：frontend 执行 `npm.cmd run build` 通过；backend 设置专项执行 `py -m pytest .\tests -q -k "settings_ai_model_library_bindings_can_be_saved_and_used_by_nurture_regeneration or settings_ai_model_scenarios_and_email_writers_can_be_saved or settings"` 结果 15 passed；backend 全量执行 `py -m pytest .\tests -q` 结果 103 passed。
