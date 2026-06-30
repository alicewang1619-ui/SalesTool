# TDD 测试设计文档：接口契约

## 1. 单元元信息
| 字段 | 内容 |
| :--- | :--- |
| 测试层 | 集成契约 |
| 单元短码 | API |
| 对应上游产物 | 技术方案.md API/数据模型/安全；PRD详细版.md AC-1~AC-20 |
| 所属产品/模块 | FastAPI 后端接口与数据库副作用 |

## 2. 测试策略
- P0：认证、线索写入、销售数据范围、背景调查、Banner、账号权限接口契约必须稳定。
- P1：再营销任务、附件、来源配置、报表聚合和审计日志必须覆盖。
- 不测：前端具体样式和真实第三方服务。

## 3. 测试用例清单
| ID | 用例名称 | 优先级 | Given | When | Then | 预期失败原因 | 来源 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| I-API-01 | 登录成功返回会话和角色 | P0 | 有效管理员账号 | POST `/auth/login` | 返回 token/session、role、permissions | 未实现时前端无法识别角色 | 技术方案 认证 |
| I-API-02 | 官网聊天 Webhook 写入 Inquiry | P0 | 官网聊天样例线索 | POST `/inquiries/webhook` | 生成 Inquiry，带 source_group_id/source_channel_id 和快照 | 未实现时线索无法统一进入线索池 | PRD AC-1 |
| I-API-03 | 邮箱导入失败项可查询 | P0 | 邮箱导入含成功和失败行 | POST 导入后 GET 失败项 | 成功行生成 Inquiry，失败项含原因 | 未实现时运营无法修复导入失败 | PRD AC-2 |
| I-API-04 | 线索列表来源筛选按 ID 生效 | P0 | 数据库含五类来源线索 | GET `/inquiries?source_group_id=social` | 仅返回社媒来源，含具体来源标签 | 未实现时筛选只在前端假过滤 | 技术方案 查询 |
| I-API-05 | 销售查询线索被后端过滤 | P0 | 销售 A/B 各有线索 | 销售 A GET `/inquiries` | 只返回 A 负责线索 | 未实现时出现水平越权 | PRD AC-19 |
| I-API-06 | 客户导入触发背景调查任务 | P0 | 新客户由导入创建 | 导入完成 | 写入客户详情并入队背景调查任务 | 未实现时客户详情缺背景调查 | PRD AC-7A |
| I-API-07 | 保存背景调查人工修改写审计 | P0 | 授权运营修改背景调查 | PUT `/customers/{id}/background` | 新版本保存，AuditLog 有修改人和前后版本 | 未实现时修改不可追溯 | PRD AC-7A |
| I-API-08 | Banner 发布影响所有页面配置读取 | P0 | 管理员发布新 Banner | GET `/config/banner/active` | 返回新图片、文案、链接和发布时间 | 未实现时页面 Banner 不统一 | PRD AC-17 |
| I-API-09 | 普通销售不能发布 Banner | P0 | 销售 token | POST `/config/banner/publish` | 返回 403 并写权限失败审计 | 未实现时销售能修改全局公告 | PRD 7.4 |
| I-API-10 | 账号权限保存生成数据范围 | P0 | 管理员配置销售 A 仅本人 | PUT `/accounts/{id}/permissions` | User/Role/Permission/SalesAssignment 范围正确写入 | 未实现时配置页和接口权限不一致 | 页面 账号权限.md |
| I-API-11 | 来源字典停用不删除历史引用 | P1 | 来源已被历史线索引用 | POST `/sources/{id}/disable` | 来源停用，历史线索仍显示快照 | 未实现时历史数据丢失或展示空白 | 技术方案 SourceDictionary |
| I-API-12 | 再营销任务生成保留模型版本 | P1 | 客户满足触达条件 | POST `/nurture-tasks/generate` | NurtureTask 含 model_provider、model_version、上下文快照 | 未实现时无法审计大模型输出 | 技术方案 NurtureTask |
| I-API-13 | 提示词和附件保存后参与重新生成 | P1 | 草稿详情补充 prompt 和附件 | POST `/nurture-tasks/{id}/regenerate` | 新草稿引用 generation_prompt 和 attachment_refs | 未实现时用户补充材料无效 | PRD AC-20 |
| I-API-14 | 再营销发送必须先人工确认 | P0 | 草稿未确认 | POST `/nurture-tasks/{id}/send` | 返回 409 或 422，状态保持待确认 | 未实现时系统可能自动发送未审邮件 | PRD AC-14 |

## 4. Mock 策略
| 依赖 | Mock 方式 | 理由 | 关联用例 |
| :--- | :--- | :--- | :--- |
| AI Provider | mock server 返回结构化 JSON | 集成层验证服务封装和副作用，不打真实模型 | I-API-06、I-API-12、I-API-13 |
| 邮箱/SMTP | mock SMTP 或 Graph sandbox | 避免真实发信 | I-API-14 |
| 文件存储 | 本地临时桶或 fake storage | 验证元数据和引用 | I-API-13 |

## 5. 实现顺序建议
P0：I-API-01 -> I-API-02 -> I-API-05 -> I-API-06 -> I-API-07 -> I-API-08 -> I-API-09 -> I-API-10 -> I-API-14。  
P1：I-API-03 -> I-API-04 -> I-API-11 -> I-API-12 -> I-API-13。
