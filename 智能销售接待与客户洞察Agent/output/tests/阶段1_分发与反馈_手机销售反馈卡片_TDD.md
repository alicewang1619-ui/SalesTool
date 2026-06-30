# 页面 TDD：阶段1_分发与反馈_手机销售反馈卡片

## 来源
- 功能文档：`output/pages/阶段1_分发与反馈_手机销售反馈卡片.md`
- 原型蓝图：`output/pages/阶段1_分发与反馈_手机销售反馈卡片.html`
- 聚合门禁：`tests/e2e/MVP业务闭环_TDD.md`、`tests/crosscut/安全鉴权_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-FEEDBACK-01 | P0 | 销售打开未过期且归属自己的反馈链接 | 渲染 H5 卡片 | 显示客户摘要、状态按钮、客户判断选项、备注和提交反馈按钮，Banner 不遮挡表单 | 原型控件缺失会导致销售无法 10-30 秒反馈 |
| PAGE-FEEDBACK-02 | P0 | 销售提交“已联系/有效客户/备注” | 调用反馈 API | 后端校验 token、负责人和有效期，写入 SalesFeedback 并更新线索状态 | 只写前端状态无法形成闭环 |
| PAGE-FEEDBACK-03 | P0 | 非负责人或过期链接访问 | 打开链接 | 返回销售链接过期页或无权限页，不泄露客户详情 | 链接绕过会泄露客户资料 |
| PAGE-FEEDBACK-04 | P1 | 重复点击提交 | 连续发送请求 | 后端幂等处理，只保留一次有效反馈和一次审计记录 | 重复提交会污染反馈历史 |
| PAGE-FEEDBACK-05 | P2 | 手机窄屏输入长备注 | 提交前检查布局 | 按钮、单选项和备注框无重叠，焦点可见 | 移动端布局破坏会阻断销售使用 |

## 当前落地映射（06-30-2026）
- 后端模型：`SalesFeedbackLink` 负责 7 天安全链接，`SalesFeedback` 负责一次有效提交记录，`link_id` 唯一约束用于幂等。
- 后端接口：`GET /api/feedback-links/{token}` 返回 H5 卡片数据；`POST /api/feedback-links/{token}/submit` 校验 token、有效期、负责人一致性后写入反馈并更新线索状态。
- 前端路由：`/feedback/:token` 渲染真实 H5 反馈卡片，包含全局 Banner、客户摘要、AI 判断理由、反馈状态、客户判断、备注和提交反馈。
- 当前自动化验证：`py -m pytest .\tests -q -k feedback` 为 6 passed；后端全量 `py -m pytest .\tests -q` 为 30 passed；前端 `npm.cmd run build` 通过。
