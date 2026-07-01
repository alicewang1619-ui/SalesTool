# 页面 TDD：阶段1_线索池_线索池列表

## 来源
- 功能文档：`output/pages/阶段1_线索池_线索池列表.md`
- 原型蓝图：`output/pages/阶段1_线索池_线索池列表.html`
- 聚合门禁：`tests/integration/接口契约_TDD.md`、`tests/unit/核心领域规则_TDD.md`

## 用例
| ID | 优先级 | Given | When | Then | 预期失败原因 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAGE-LEADS-01 | P0 | 后台已配置客户来源字典 | 打开线索池列表 | 来源筛选读取真实字典，显示网站、邮箱、社媒、线下展会、其他等启用来源 | 写死筛选项会与后台配置脱节 |
| PAGE-LEADS-02 | P0 | 选择“邮箱”来源筛选 | 请求列表 API | API 使用分页和 source_category 条件返回数据，表格只显示邮箱来源记录 | 前端过滤全量数据会违反分页红线 |
| PAGE-LEADS-03 | P0 | 表格展示线索记录 | 渲染列表 | 客户、国家、类型、产品、来源、评分、反馈、动作列与原型一致 | 少列会导致运营无法选择下一步动作 |
| PAGE-LEADS-04 | P1 | 点击“查看详情” | 进入线索详情 | 使用真实 lead id 跳转，详情页能查询同一条记录 | 假链接无法打通列表到详情 |
| PAGE-LEADS-05 | P2 | 列表无匹配结果 | 应用筛选 | 展示空状态、清除筛选入口和来源说明 | 空白页会被误判为系统故障 |


## ��ǰ�Զ�����أ�06-30-2026��
- ���� `test_source_dictionary_drives_leads_filter_options`����֤ `GET /api/source-dictionary` ����������Դ�ֵ䣬��Դ��ǩ�������������䡱���ҵ�ǰ������ `source_category` �������ֵ� category��
- ���� `test_lead_detail_returns_same_record_and_respects_sales_scope`����֤ `GET /api/leads/{id}` �ܷ������б�ͬһ����ʵ�����������˺ſɿ��Լ��� GlobalMed Peru�����ܿ�δ�����Լ��� Al Noor Hospital��
- ���� `test_leads_are_paginated_and_source_filtered` ���������б� API ʹ�� `page_size` �� `source_category` ���ˣ�����ǰ��ȫ�������ƻ���ҳ��
- ǰ�����ղ��䣺�������б����� `fetchSourceDictionary()` ������Դɸѡ�����б��ֿͻ������ҡ����͡���Ʒ����Դ�����֡���������������״̬�����ṩ�����Դɸѡ��ڣ��鿴�������Я����ʵ `recordId`��
- ��ǰ��֤�����`py -m pytest .\tests -q` Ϊ 14 passed��`npm.cmd run build` ͨ����
## 2026-07-01 二次统一返修 TDD
- 打开 `/admin/leads` 时，页面标题右上角不得出现重复“筛选/确认”按钮。
- 来源筛选项必须来自客户来源字典接口；新增或停用来源后，线索池筛选项同步变化。
