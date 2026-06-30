# 页面 TDD：阶段1_线索池_线索详情

## 来源
- 功能文档：`output/pages/阶段1_线索池_线索详情.md`
- 原型蓝图：`output/pages/阶段1_线索池_线索详情.html`
- 聚合门禁：`tests/e2e/MVP业务闭环_TDD.md`、`tests/integration/接口契约_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-LEAD-DETAIL-01 | P0 | 存在线索、会话、评分、背景摘要和反馈历史 | 打开线索详情 | 页面展示原始询盘、会话、客户画像、评分理由、背景摘要、分发和反馈历史 | 只展示列表字段无法支撑人工判断 |
| PAGE-LEAD-DETAIL-02 | P0 | 运营修改分发信息 | 保存分发 | 后端事务写入负责人、状态和审计日志，刷新后仍可查到 | 只改前端状态会丢失分发结果 |
| PAGE-LEAD-DETAIL-03 | P0 | 销售角色访问未分配给自己的线索 | 请求详情 API | API 返回 403，页面进入无权限态 | 只隐藏前端入口不能防越权 |
| PAGE-LEAD-DETAIL-04 | P1 | 背景补全任务仍在运行 | 打开详情 | 展示任务状态、上次更新时间和可重试入口 | 长任务无状态会让运营重复触发 |
| PAGE-LEAD-DETAIL-05 | P2 | 页面加载失败 | 点击重试 | 重新请求同一 lead id，不产生重复副作用 | 重试若重复写入会污染历史 |

## 当前自动化落地（06-30-2026）

- `PAGE-LEAD-DETAIL-01` 已落到后端契约测试 `test_lead_detail_returns_full_context_for_manual_judgement`：校验详情接口返回原始询盘、会话、画像、评分理由、背景调查、分发状态和反馈历史。
- `PAGE-LEAD-DETAIL-02` 已落到后端契约测试 `test_lead_assignment_update_persists_and_writes_audit`：校验分发保存持久化、刷新可查，并产生 `lead_assignment_updated` 审计日志和 trace id。
- `PAGE-LEAD-DETAIL-03` 继续由 `test_lead_detail_returns_same_record_and_respects_sales_scope` 覆盖：销售账号可访问本人线索，访问他人线索返回 403。
- 前端门禁通过 `npm.cmd run build` 覆盖类型检查与生产构建；真实详情页为 `frontend/src/pages/LeadDetailPage.tsx`，路由为 `/admin/leads/:leadId`。
- 当前后端门禁：`py -m pytest .\tests -q` 为 16 passed；仍保留 FastAPI `on_event` 与 `datetime.utcnow` deprecation warning 作为后续技术债。
