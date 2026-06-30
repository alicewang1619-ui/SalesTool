# 页面 TDD：阶段1_异常与权限_销售链接过期页

## 来源
- 功能文档：`output/pages/阶段1_异常与权限_销售链接过期页.md`
- 原型蓝图：`output/pages/阶段1_异常与权限_销售链接过期页.html`
- 聚合门禁：`tests/crosscut/安全鉴权_TDD.md`、`tests/e2e/MVP业务闭环_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-LINK-EXPIRED-01 | P0 | 销售反馈链接超过 7 天 | 打开链接 | 页面显示链接过期说明和重新发送提示，不展示客户详情 | 过期链接泄露客户资料是安全漏洞 |
| PAGE-LINK-EXPIRED-02 | P0 | 非负责人打开有效链接 | 请求反馈卡片 | 后端拒绝并展示无效/过期页，写安全日志 | 只校验过期不校验负责人会越权 |
| PAGE-LINK-EXPIRED-03 | P1 | 运营重新发送反馈链接 | 调用重发 API | 旧链接失效，新链接有效期重新计算并审计 | 多链接同时有效会增加泄露风险 |
| PAGE-LINK-EXPIRED-04 | P1 | 链接 token 被篡改 | 打开页面 | API 返回无效链接错误，不抛裸异常 | token 异常未处理会暴露内部信息 |
| PAGE-LINK-EXPIRED-05 | P2 | 手机端访问过期页 | 渲染页面 | 文案、按钮和 Banner 在窄屏无重叠 | 异常页移动体验差会影响销售处理 |


## 生产化 TDD 映射补充（2026-06-30）

### 新增可执行契约
- `test_feedback_link_expired_page_context_hides_customer_details`：覆盖过期链接上下文返回过期说明、Trace ID 和重新发送提示，且不泄露客户/产品信息。
- `test_feedback_link_owner_mismatch_context_writes_security_audit`：覆盖非负责人链接拒绝、上下文原因和 `feedback_link_owner_mismatch` 审计。
- `test_ops_resend_feedback_link_deactivates_old_link_and_audits`：覆盖运营重发后旧链接 410、新链接 200、有效期重新计算和 `feedback_link_resent` 审计。
- `test_tampered_feedback_link_context_returns_safe_invalid_message`：覆盖篡改 token 返回安全不可用提示，不暴露堆栈。

### 红绿记录
- 红灯：销售链接过期页专项为 4 failed、78 deselected；失败原因为 `/api/feedback-links/{token}/expired-context` 与 `/api/feedback-links/{token}/resend` 尚未实现返回 404。
- 绿灯：实现后专项为 4 passed、78 deselected。
- 回归：后端全量 `py -m pytest .\tests -q` 为 82 passed；前端 `npm.cmd run build` 通过，保留既有 Vite chunk size warning。
- 浏览器：Playwright 以 390px 手机视口打开已过期 `/feedback/expired-browser` 链接，可见 Banner、过期说明、重新发送提示、Trace ID；不展示 GlobalMed Peru 或 Portable Ultrasound，无横向溢出，控制台 warning/error 为 0。

### 门禁结论
- P0：过期链接不展示客户详情、非负责人链接拒绝并审计已转绿。
- P1：运营重发旧链失效新链生效、篡改 token 安全提示已转绿。
- P2：手机端文案、按钮和 Banner 无重叠已通过浏览器验收。

### 独立复核状态

- GOAL 独立验收代理派生失败，工具返回 `agent thread limit reached`；当前无法取得独立验收官签字。
- 当前本地闭环证据：销售链接过期页专项 4 passed；后端全量 `py -m pytest .\tests -q` 为 82 passed；前端 `npm.cmd run build` 通过；Playwright 手机视口验证过期页、重新发送提示、Trace ID、敏感信息隐藏、无横向溢出和控制台质量通过；文档已同步。
