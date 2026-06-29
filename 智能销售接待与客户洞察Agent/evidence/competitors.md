# 竞品与相关方案调研

调研日期：2026-06-29

## 调研范围

本项目不是单一客服机器人，而是面向 ultrasound 海外销售的 AI 客户增长系统。因此调研对象按能力拆分：

- AI SDR / 在线销售接待
- 在线聊天与线索资格判定
- 客户数据补全与线索评分
- 线索路由与销售分发
- 销售反馈、报表与线索恢复

## 竞品/相关产品矩阵

| 产品 | 类型 | 公开定位/能力 | 对本项目的启发 | 来源 |
|---|---|---|---|---|
| Qualified Piper | AI SDR | 24/7 网站接待、按公司规模/意图/CRM 数据等规则判定线索、将合适潜客交给团队 | 高质量线索应由业务规则定义；我们的规则是“身份明确 + 应用明确 + 需求明确” | https://www.qualified.com/ai-sdr |
| Salesloft Drift | Conversational Marketing / Chat Agent | 用对话式 AI 实时接待访客、问预设问题、捕捉关键数据、将高意向访客路由给销售 | 证明“在线接待 + 引导提问 + 高意向路由”是成熟方向 | https://www.salesloft.com/platform/drift |
| Fin for Sales | AI Sales Agent / AI SDR | 从最初兴趣到合格机会，进行产品讲解、资格判定、路由和上下文交接；支持 playbook、数据采集、lead recovery、报表 | 最接近本项目的“AI 售前接待员”形态；但其默认接入 CRM/Calendly 等生态，我们需要做轻量版 | https://fin.ai/sales |
| Intercom Fin for Sales Help | 配置与报表 | 可定义 qualification criteria、routing outcomes、data to collect、lead recovery；报表看会话量、联系方式捕获率、完成率、qualification funnel | 本项目也应有“数据采集字段 + 路由结果 + 未完成对话恢复 + 报表”四件套 | https://www.intercom.com/help/en/articles/13927077-how-to-train-fin-for-sales / https://www.intercom.com/help/en/articles/13927082-analyze-and-report-on-fin-for-sales |
| HubSpot Breeze Intelligence | 数据补全/意图识别 | 用数据补全做 buyer intent、表单缩短、lead scoring、营销分群、个性化和 workflow | 客户背景调查不应只靠销售人工查；可先做公开信息/邮箱域名/官网识别，后续再接商业数据源 | https://knowledge.hubspot.com/records/get-started-with-data-enrichment |
| Clearbit by HubSpot | Lead scoring & routing / Enrichment | 用一致上下文进行实时评分和路由，减少 bad fits、misrouting、manual sorting | 本项目“国家/区域 → 销售负责人”就是垂直化 routing；客户画像字段可用于评分 | https://clearbit.com/solutions/lead-scoring-routing |
| Chili Piper | Inbound conversion / Routing / Scheduling | Webform 后即时判定、智能路由、连接正确销售、追踪 meeting/no-show/cancellation 等 | 线索不应只“分发”，还要追踪状态；本项目可借鉴状态闭环，但不必一开始做会议预约 | https://www.chilipiper.com/inbound-lead-conversion |
| Zoho SalesIQ | Visitor engagement / Lead scoring / Routing | 通过访问行为、触发状态、UTM、CRM 值、聊天历史等条件打分；聊天可按部门/专长/CRM owner 路由 | 本项目可做规则评分：国家、身份、应用、需求完整度、产品类型、渠道、客户池状态 | https://www.zoho.com/salesiq/ / https://help.zoho.com/portal/en/kb/salesiq-2-0/for-administrators/people/articles/leadscoring |
| Salesforce Agentforce Lead Nurturing | CRM-native AI Agent | 初次触达、跟进、回答问题、会议预约，让销售有更多时间做关系维护 | 方向成立，但重 CRM 生态不适合本项目第一版；我们应避免上来做复杂 CRM | https://help.salesforce.com/s/articleView?id=sales.sales_agent_sdr_intro.htm&language=en_US&type=5 |

## 成熟产品的共同模式

1. **资格判定不是自由聊天，而是 playbook**
   - Fin 明确要求定义 qualification criteria、data to collect 和 routing outcomes。
   - 对本项目：应把 ultrasound 的身份、应用、需求、国家、产品类型等做成接待 playbook。

2. **AI 负责前半段，销售负责关键判断**
   - Fin/Drift/Qualified 都强调 AI 接待、判定、路由，但高价值机会仍交给销售。
   - 对本项目：AI 不替代销售，只做整理、引导、评分、提醒和报表。

3. **路由需要明确规则**
   - Chili Piper、Clearbit、Zoho 都把 routing 当作核心能力。
   - 对本项目：国家/区域是第一路由规则，需要维护“区域-国家-销售人员”映射表。

4. **客户背景补全是提高线索质量的关键**
   - HubSpot/Clearbit 都强调 enrichment、buyer intent、lead scoring。
   - 对本项目：代理商需查历史业务、品牌、超声经验、业务规模；医生需查科室、应用、机器经验、预算和场景。

5. **报表不只是数量统计**
   - Fin 报表看 performance、leads、conversations；Chili Piper 看 meeting/no-show/cancellation 等转化节点。
   - 对本项目：报表应覆盖询盘总量、有效数量、国家、渠道、代理商/医生占比、产品分类、销售反馈、未及时反馈、撤单、再营销数据、客户池变化。

6. **lead recovery 是值得做的能力**
   - Fin 支持 prospect 停止回复后的恢复动作。
   - 对本项目：已报价未回复、暂无明确需求、撤单/流失客户都应进入客户池和再营销流程。

## 成熟产品没有完全覆盖的本项目差异

| 差异点 | 为什么重要 |
|---|---|
| ultrasound 垂直话术 | 通用 AI SDR 不知道 ultrasound 应用、科室、探头、机器类型、医生/代理商差异 |
| 代理商 + 医生双客群 | 大多数 B2B 工具默认公司线索，本项目要同时处理代理商和终端医生 |
| 无 CRM 起步 | 竞品多数默认接 Salesforce/HubSpot；本项目当前没有 CRM，需要轻量反馈卡片 |
| 销售反馈不能复杂 | 成熟 CRM 要求记录很多字段；本项目要控制在 10-30 秒反馈 |
| 非金额型报表 | 本项目不看成交金额/报价金额，先看询盘质量、客户结构、反馈效率和客户池变化 |
| 人工确认再营销 | 竞品可自动化流程较多；本项目第一版必须人工确认后发送，避免误发/骚扰 |

## 风险与约束

1. **不要把 AI SDR 当成完整销售替代**
   - Chili Piper 的 GTM 讨论指出，AI SDR 更像一组能力包：账户研究、线索判定、路由、个性化外联、预约等；不应宣称替代完整 SDR。
   - 来源：https://www.chilipiper.com/post/ai-sdr-myth-what-gtm-leaders-say

2. **长对话需要升级给人**
   - 同一来源指出 AI 在早期对话、基础问题和简单判定上表现较好，但复杂 discovery、谈判和上下文变化容易出问题。
   - 对本项目：Agent 应有明确升级规则，例如客户提出复杂价格、代理政策、注册证书、售后承诺时交给销售。

3. **LinkedIn/Facebook 监测要合规**
   - LinkedIn 明确不允许使用第三方爬虫/机器人/扩展抓取或自动化活动；应优先使用官方 API、授权数据或公开网页监测。
   - Meta Webhooks/Graph API 可用于订阅授权对象变化。
   - 来源：https://www.linkedin.com/help/linkedin/answer/a1341387 / https://developers.facebook.com/docs/graph-api/webhooks/ / https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-lookup-api?view=li-lms-2026-06

## 对本项目 V0 的建议

1. 先做 **多渠道线索收口 + 统一线索对象**，不急着做大 CRM。
2. 建立 ultrasound 接待 playbook：身份、国家、应用领域、产品类型、具体需求、代理商/医生分支。
3. 建立客户画像卡：代理商画像、医生画像两套字段。
4. 建立国家/区域路由表，把线索自动分发给销售。
5. 销售反馈采用轻量卡片：状态 + 客户判断 + 可选一句备注。
6. 报表先做非金额型经营分析。
7. 再营销由 AI 生成内容，但必须人工确认后发送。
8. 客户态势监督先做轻量版本：官网公开信息、授权社媒数据、邮件行为、销售反馈信号。
