# Design System Inspired by 智能销售接待与客户洞察 Agent

> Category: Productivity & SaaS
> 一套面向 ultrasound 海外销售增长的蓝紫色医疗科技 SaaS 设计系统，用稳定、冷静、可追溯的界面把分散询盘变成可经营的客户资产。

## 1. 视觉主题与氛围

这套设计系统的核心隐喻是“销售线索指挥台”。用户不是在浏览一个漂亮网页，而是在一张清澈、安静、可信的控制台前处理真实客户机会。屏幕上的每条线索都像一条从不同渠道汇入的细流，经过 AI 补全、国家分发、销售反馈和客户池沉淀，最终变成可以被复盘和再次经营的客户资产。

产品的日常使用者是营销负责人、运营和管理员，他们每天要看大量线索、表格、状态、国家和销售反馈。设计不应该给他们制造额外情绪，不应该像营销落地页那样抢戏。它要让人感觉“这件事终于被收住了”：今日询盘在哪里、谁没有反馈、哪个国家突然变多、官网渠道质量如何，都能被快速扫到。

用户情绪是稳定、冷静、可控。销售增长系统天然有紧迫感，客户可能因为响应慢而流失，销售也可能因为反馈太麻烦而不提交。设计要把紧迫感折叠进清晰的状态线和待办，而不是用大红警报制造焦虑。

采用浅色模式，是因为后台需要长期工作和扫描。浅色背景能保持数据、表格和输入控件的可读性；蓝紫主色带来 AI Agent 的科技感，但不会落入青蓝医疗模板。蓝紫色不是大面积背景，而是一条贯穿线索状态的“信号带”：从工作台、线索详情到销售反馈卡片，用户始终能识别出关键状态和主操作。

风格定位属于企业 SaaS / CRM 工作台类，参考 Linear 的秩序感、Stripe Dashboard 的信息克制、Ant Design Pro 的后台密度和 HubSpot CRM 的销售流程清晰性。它不追求强烈个性，而追求让企业内部团队可以放心长期使用。

| 核心色 | Hex | 角色 |
| :--- | :--- | :--- |
| 背景 | #F7F8FC | 长时间工作底色 |
| 卡片 | #FFFFFF | 表格、卡片和表单承载面 |
| 蓝紫主色 | #5B4BDB | 主操作、选中态、状态带 |
| 成功绿 | #168A5B | 有效、已完成、正向反馈 |
| 提醒琥珀 | #A96500 | 待补充、未反馈、提醒 |
| 危险红 | #C2413B | 无效、失败、危险操作 |

设计签名是蓝紫色“线索状态带”。它不是装饰线，而是状态语法：有效、未反馈、待分配、待确认、已完成都围绕同一组状态色表达。截图给项目外的人看，应能认出这是一个围绕销售线索闭环的系统，而不是普通 CRM 模板。

参考先例：

| 参考 | 汲取内容 |
| :--- | :--- |
| Linear | 克制的层级、干净的焦点态、低噪声工作台 |
| Stripe Dashboard | 高密度数据下仍保持清晰边界 |
| Ant Design Pro | 后台导航、表格和筛选的成熟模式 |
| HubSpot CRM | 线索状态、销售反馈和客户经营的业务语言 |

## 2. 色彩美学

色彩策略是“中性承载，蓝紫指路，语义色只在需要判断时出现”。中性色占画面 70-90%，蓝紫主色占 5-10%，语义色占 0-5%。每屏可见的蓝紫强调最多保留 2 处：一个主按钮或选中态，一个状态带或重点指标。这样能让用户在高频后台中保持判断力。

蓝紫主色 #5B4BDB 承担品牌和 AI Agent 的科技感。它比青蓝更少医疗模板感，也比纯紫更稳重。绿色只表示有效和成功，琥珀表示待处理和提醒，红色表示无效、失败和危险操作。所有语义色不用于装饰，只用于业务判断。

| Surface Token | Hex | 用途 |
| :--- | :--- | :--- |
| --bg | #F7F8FC | 页面背景，降低长时间观看疲劳 |
| --surface | #FFFFFF | 卡片、表格、抽屉主体 |
| --surface-warm | #FBFAFF | 轻微蓝紫温度，用于重点区域 |
| --surface-hover | #F1F0FF | 悬停、选中、行焦点 |
| --border | #D9DEEA | 主边界 |
| --border-soft | #E8ECF5 | 轻边界 |

| Accent / Semantic | Hex | 情感与功能 |
| :--- | :--- | :--- |
| --accent | #5B4BDB | 关键动作、状态带、焦点 |
| --success | #168A5B | 有效、完成、已成交 |
| --warn | #A96500 | 待补充、未反馈、需跟进 |
| --danger | #C2413B | 无效、失败、危险 |

| Text Token | Hex | 可读性 |
| :--- | :--- | :--- |
| --fg | #111827 | 主文本，对背景具备 AA 对比 |
| --fg-2 | #374151 | 次级文本 |
| --muted | #667085 | 说明文本 |
| --meta | #8A92A6 | 元信息 |

所有普通文本与主背景保持 WCAG AA 对比；主按钮使用 #5B4BDB 与白色文字配对。禁止用青蓝替代主色，禁止把状态色当背景大面积铺开。

## 3. 排版与字体

字体哲学是“数字可扫读，中文不费眼，英文客户信息保持国际业务质感”。Display、Body 均使用 Inter + Microsoft YaHei / Noto Sans SC / system-ui。英文客户名、国家、渠道和数字指标在 Inter 下更紧凑；中文后台说明在 Microsoft YaHei 和 Noto Sans SC 下更稳定。

Mono 使用 JetBrains Mono / SFMono / Consolas，用于 ID、时间、UTM、接口状态和审计日志。等宽字体让系统证据更像可核查记录，而不是随意备注。

字号梯度从 12px 到 44px。工作台大指标使用 32-44px，列表和表单保持 13-14px，避免后台过度放大导致扫描效率下降。

| 场景 | 字距 |
| :--- | :--- |
| ALL CAPS | 0.08em |
| Display 大字 | -0.02em |
| 标题 | -0.01em |
| 小文本 | 0.01em |
| UI 标签 / 按钮 | 0.02em |
| 正文 | 0 |

Line-height 正文 1.6，标题 1.18。表格中使用较紧凑行高，详情页正文和 AI 判断理由使用更舒展行高。

Font labels for catalog extraction:

Display: Inter, "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif
Body: Inter, "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif
Mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace

## 4. 间距体系

间距采用 4px 基准。后台中控件需要精确对齐，4px 节奏能同时支持高密度表格和呼吸感卡片。space-1 到 space-12 覆盖小控件、表格单元格、卡片内距和页面区块。

桌面端页面区块使用 64px 的垂直节奏；平板为 48px；手机销售反馈卡片为 32px，保证移动端操作不拥挤。列表筛选区和表格行使用 8-16px 的细密节奏，工作台 Bento 卡片使用 20-24px 的节奏。

## 5. 布局与空间构成

PC 后台使用左侧常驻导航 + 主内容区。主内容采用 Bento Grid 承载工作台和报表，因为这个产品的核心不是讲故事，而是让多类指标和待办在同一屏建立关系。Bento Grid 把“今日新增、有效线索、未反馈、官网渠道 KPI、再营销待确认”拆成独立认知单元，让管理者不必在多个页面之间来回跳。

列表页遵循“筛选区在上，表格为主，详情从列表进入”的模式。详情页使用主信息 + 侧栏时间线/状态卡的结构，让 AI 摘要、客户画像、评分理由、分发记录和销售反馈保持同屏可读。

手机销售反馈卡片不复制完整后台。它采用单列卡片结构，只保留客户摘要、AI 判断理由、状态选择、客户判断、可选备注和提交按钮。销售在手机上看到的是“该做什么”，不是“系统有什么”。

Container 最大宽度 1280px，桌面 gutter 32px，平板 24px，手机 16px。层级以边界、背景微差和色彩响应表达，不使用夸张阴影。

## 6. 组件设计

组件语言是色彩响应型。组件 hover 不做大位移，不用夸张阴影；主要通过边框、背景和焦点环变化告诉用户“这里可操作”。这符合后台工具的稳定感，也让高频操作不会显得跳动。

按钮分为主按钮和次按钮。主按钮只用于高价值提交：分发、提交反馈、确认发送、导出确认。次按钮用于查看详情、筛选、返回和重试。所有按钮都有 hover、active、focus-visible 状态。

卡片承载一个独立认知单元。卡片的圆角不超过 8px，保持专业工作台气质。卡片左侧可挂蓝紫状态带，表达线索状态而不是纯装饰。

输入框以清晰边界、焦点环和错误态为主。错误只在当前区域提示，不用全局大弹窗打断。

徽章用于客户类型、状态、渠道和风险。徽章文案必须是业务可理解的状态，不出现技术状态码。

组件 CSS：

```css
.btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  min-height: 40px;
  font-weight: 700;
  transition: border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard);
}
.btn:hover { border-color: var(--accent); box-shadow: var(--focus-ring); }
.btn:active { background: var(--surface-hover); }
.btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-on); }
.btn.primary:hover { background: var(--accent-hover); }
.btn.primary:active { background: var(--accent-active); }
.card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--elev-ring);
}
.card:hover { border-color: color-mix(in oklab, var(--accent), var(--border) 45%); background: var(--surface-warm); }
.input {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  border-radius: var(--radius-md);
  min-height: 40px;
}
.input:focus { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.badge { border-radius: var(--radius-pill); border: 1px solid var(--border-soft); font-weight: 800; }
```

## 7. 动效与交互物理

动效是确认，不是表演。后台用户需要知道按钮已响应、输入框已聚焦、卡片可点击，但不需要被动画吸走注意力。统一使用 150ms 和 200ms 的短动效，曲线为 cubic-bezier(0.2, 0, 0, 1)。

```css
.micro-action {
  transition: border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard);
}
.micro-action:hover { border-color: var(--accent); }
.micro-action:active { background: var(--surface-hover); }
@keyframes rise-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.enter { animation: rise-in var(--motion-base) var(--ease-standard) both; }
@media (prefers-reduced-motion: reduce) {
  .enter, .micro-action { animation: none; transition: none; }
}
```

## 8. 品牌情感与声音

如果这个产品是一个人，它是一个冷静、细致、靠谱、懂销售节奏的运营负责人。它不会替销售夸大承诺，也不会让营销负责人看一堆无法行动的图表。它说话要短、准、可执行。

品牌关键词：可信、敏捷、克制、可追溯、懂业务。

空状态不卖萌，只告诉用户下一步怎么把线索导入系统。Loading 用骨架屏，404 和无权限页保持同样的蓝紫状态带，说明原因并提供回到工作台或重新发送链接的路径。

Agent 设计指令：
1. 优先让用户扫到状态、负责人和下一步动作。
2. 不使用营销落地页式 hero 和大面积装饰。
3. 所有关键动作必须能回到线索闭环。
4. 不展示成交金额和报价金额。
5. 社媒数据必须标注授权边界。

## 9. 设计禁忌

- 禁止使用青蓝作为品牌主色，因为用户已明确选择蓝紫色，青蓝会回到普通医疗模板。
- 禁止把页面做成营销落地页，因为这是内部高频后台，不是对外宣传页。
- 禁止大圆角和厚重阴影，因为会降低表格密度和企业工具的稳定感。
- 禁止在报表中展示成交金额或报价金额，因为用户明确不需要金额类指标。
- 禁止让销售端出现复杂表单，因为销售反馈目标是 10-30 秒完成。
- 禁止未授权抓取 Facebook/LinkedIn，因为第一版合规边界已确认。
- 禁止在一个页面堆满所有异常状态，高保真原型只展示典型完整数据。
- 禁止使用默认 Tailwind 靛蓝/紫色替代设计 token，所有颜色必须来自 tokens.css。
