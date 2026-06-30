# 页面 TDD：阶段1_异常与权限_无权限页

## 来源
- 功能文档：`output/pages/阶段1_异常与权限_无权限页.md`
- 原型蓝图：`output/pages/阶段1_异常与权限_无权限页.html`
- 聚合门禁：`tests/crosscut/安全鉴权_TDD.md`、`tests/crosscut/无障碍_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-FORBIDDEN-01 | P0 | 用户访问无权限页面或动作 | 后端返回 403 | 页面展示无权限说明、返回入口和 trace id，不显示敏感业务数据 | 只隐藏入口不能解释越权原因 |
| PAGE-FORBIDDEN-02 | P0 | 销售访问管理员设置 API | 直接请求接口 | 返回 403 并写安全审计 | 页面拦截不能替代接口鉴权 |
| PAGE-FORBIDDEN-03 | P1 | 用户点击返回工作台 | 操作按钮 | 跳转到其角色可访问的默认首页 | 返回无效路由会形成死路 |
| PAGE-FORBIDDEN-04 | P1 | 会话已过期而非权限不足 | 打开受限页 | 跳转登录页并显示会话过期原因 | 混淆 401/403 会影响排错 |
| PAGE-FORBIDDEN-05 | P2 | 键盘和读屏用户访问 | 检查页面 | 标题、原因、按钮焦点和 aria 描述可读 | 异常页无障碍缺失会阻断用户 |


## 生产化 TDD 映射补充（2026-06-30）

### 新增可执行契约
- `test_forbidden_context_returns_role_home_reason_and_trace`：覆盖无权限上下文 API 返回角色、来源页、默认工作台、处理建议和 trace id。
- `test_forbidden_context_distinguishes_expired_session_from_403`：覆盖未登录访问无权限上下文仍为 401，避免把会话过期误判为 403。
- `test_sales_forbidden_settings_api_writes_security_audit`：覆盖销售直接请求设置 API 返回 403，并写入 `permission_denied` 安全审计。

### 红绿记录
- 红灯：`py -m pytest .\tests -q -k forbidden` 为 3 failed、75 deselected；失败原因为 `/api/forbidden/context` 返回 404，且 403 未写审计。
- 绿灯：实现后同命令为 3 passed、75 deselected。
- 回归：后端全量 `py -m pytest .\tests -q` 为 78 passed；前端 `npm.cmd run build` 通过，保留既有 Vite chunk size warning。
- 浏览器：Playwright 以销售账号访问 `/admin/settings` 自动进入 `/admin/forbidden`，展示 Banner、来源页、原因、角色、Trace ID、回工作台和联系管理员，返回工作台成功，控制台 warning/error 为 0。

### 门禁结论
- P0：无权限说明、返回入口、trace id、接口 403 强鉴权和安全审计均已转绿。
- P1：会话过期与权限不足区分、销售角色默认返回工作台已转绿。
- P2：读屏/键盘可读性通过标题、说明、描述列表和按钮语义落地；后续可补自动化 a11y 扫描。

### 独立复核状态

- GOAL 独立验收代理派生失败，工具返回 `agent thread limit reached`；当前无法取得独立验收官签字。
- 当前本地闭环证据：无权限专项 `py -m pytest .\tests -q -k forbidden` 为 3 passed；后端全量 `py -m pytest .\tests -q` 为 78 passed；前端 `npm.cmd run build` 通过；Playwright 验证销售访问受限页自动进入无权限页、Trace ID 展示、返回工作台和控制台质量通过；文档已同步。
