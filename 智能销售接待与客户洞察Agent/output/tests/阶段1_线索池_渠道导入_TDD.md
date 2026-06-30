# 页面 TDD：阶段1_线索池_渠道导入

## 来源
- 功能文档：`output/pages/阶段1_线索池_渠道导入.md`
- 原型蓝图：`output/pages/阶段1_线索池_渠道导入.html`
- 聚合门禁：`tests/crosscut/边界异常_TDD.md`、`tests/integration/接口契约_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-IMPORT-01 | P0 | 运营上传合法 CSV/Excel | 提交导入 | 文件进入真实上传接口和异步 worker，返回任务 id，可查询导入进度 | 前端解析静态文件无法支撑生产导入 |
| PAGE-IMPORT-02 | P0 | 文件包含重复客户和缺失国家 | 执行导入 | 后端识别重复、缺失字段和失败行，成功行持久化，失败行可下载 | 不做行级校验会污染线索池 |
| PAGE-IMPORT-03 | P0 | 上传超大或非法格式文件 | 提交导入 | API 拒绝并返回明确错误码，记录安全日志，不进入 worker | 缺少格式限制会造成资源风险 |
| PAGE-IMPORT-04 | P1 | 导入任务中途失败 | 查询任务 | 页面显示失败原因、已处理数量和重试入口，重试幂等 | 长任务无恢复会导致批量导入卡死 |
| PAGE-IMPORT-05 | P2 | 字典中停用某来源 | 打开导入映射 | 停用来源不可选，历史记录仍可展示来源名称 | 字典状态未生效会导入错误来源 |


## 生产化 TDD 补充（06-30-2026）

- `PAGE-IMPORT-01` 已落为后端契约测试：`POST /api/import-jobs` 使用 multipart 文件上传，返回 `task_id`，任务状态可通过 `GET /api/import-jobs/{task_id}` 查询。
- `PAGE-IMPORT-02` 已覆盖重复客户、缺失国家、停用来源三类行级失败；成功行持久化到 `Lead`，失败行保存到 `ImportJob.failures_json`。
- `PAGE-IMPORT-03` 已覆盖非法格式文件拒绝，API 返回 `INVALID_IMPORT_FILE`，且写入 `import_rejected` 审计日志，不进入处理流程。
- `PAGE-IMPORT-04` 已覆盖失败行下载与重试任务：`GET /api/import-jobs/{task_id}/failed-rows` 返回 CSV，`POST /api/import-jobs/{task_id}/retry` 幂等返回同一任务。
- `PAGE-IMPORT-05` 已通过停用来源字典行级校验覆盖，停用来源不会被导入为有效线索。

## 验收返修 TDD 补充（06-30-2026）

- 新增 Excel 用例：构造最小 `.xlsx` 工作簿上传到 `/api/import-jobs`，断言创建响应为 `queued`、`processed_rows=0`，随后查询任务为 `completed`、`processed_rows=total_rows`，成功行进入线索池。
- CSV 用例收紧为异步语义：创建任务响应必须先返回 `queued`，查询任务再返回完成态和完整统计。
- 非法文件用例补充超大文件拒绝，覆盖 >5MB 文件不进入处理流程。
- 重试用例补充 `import_job_retried` 审计断言，确保重试动作可追溯且幂等。
