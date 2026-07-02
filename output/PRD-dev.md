# 项目知识库 · 开发版

> 给程序员 / AI 编码助手：30 分钟读完可开工。完整背景见 PRD详细版.md。

## 是什么
本地优先（local-first）的个人 AI 知识库，电脑网页端。数据全本地，本地大模型(Ollama)优先 + 云端 API 可选。几千条规模。

## MVP 范围（全部 P0，除 FR-5 为 P1）
FR-1 录入 / FR-2 自动整理 / FR-3 语义检索 / FR-4 相关推荐 / FR-5 标签聚合 / FR-6 RAG 问答 / FR-7 大模型底座 / FR-8 知识管理。
后置（不做）：浏览器插件、手机端、多端云同步、多人共用、关系图谱。

## 技术选型建议（local-first，可调整）
- 形态：桌面壳 Tauri/Electron，或 本地服务 + 浏览器访问 localhost。
- 存储：SQLite（结构化）+ 嵌入式向量库 LanceDB/Chroma（向量），全本地文件。
- 大模型：Ollama 本地优先；云端 OpenAI/Claude 兼容 API 可配置切换。
- embedding：本地中文友好轻量模型（如 bge-small-zh 类），与正文同步更新。
- 正文抓取：Readability 类通用解析 + 微信公众号适配；抓取失败回退粘贴。

## 数据模型
```
Knowledge(id, title, content, source_type[link|paste|note|file], source_url?, summary, created_at, updated_at)
Tag(id, name)
KnowledgeTag(knowledge_id, tag_id)
Embedding(knowledge_id, vector, chunk_meta)  // 存本地向量库
```

## 关键流程
```
录入：取内容(抓取/粘贴/编辑/上传) → 存 Knowledge → 异步生成 embedding + 大模型打标签/摘要/归类
检索：query → embedding → 向量检索 + 标签/关键词辅助 → 排序返回
RAG：问题 → 检索相关 chunk → 拼上下文 → LLM 生成答案 + 标来源(knowledge_id)
```

## 页面
知识列表(含搜索) / 录入页 / 知识详情(摘要+标签+相关推荐) / 标签浏览 / 问答页 / 设置(大模型配置)。

## 各功能验收
- FR-1：4 种方式均入库成功；公众号抓取失败可回退粘贴。
- FR-2：新知识自动生成 ≥1 标签 + 摘要，可手改。
- FR-3：口语化输入返回语义相关结果，相关项靠前；结果以列表卡片展示(标题/命中片段/标签/来源/相关度)，点击进详情页。
- FR-4：详情页展示 ≥3 条相关知识（内容足够时）。
- FR-5：点标签列出该标签全部知识。
- FR-6：返回答案文本 + 下方挂可点击跳原文的来源知识列表（区别于 FR-3 列表卡片）。
- FR-7：仅本地大模型时 FR-2/FR-3/FR-6 可用；切云端 API 同样可用。
- FR-8：增删改查生效，编辑后重建 embedding。

## 非功能
- 隐私：默认全本地不上传；用云端时仅发必要上下文并提示。
- 性能：几千条秒级检索；本地大模型性能依赖机器，云端兜底。
- 数据：可导出备份。

## 待技术验证（开工先验证这两条，影响架构）
- OQ-1：微信公众号正文抓取反爬可行性。
- OQ-2：目标电脑跑本地大模型/embedding 的性能与中文效果。
