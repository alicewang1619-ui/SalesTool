import { Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { Check, FileText, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCustomers,
  fetchNurtureTasks,
  type CustomerFilters,
  type CustomerListItem,
  type CustomerPageResult,
  type NurtureTask
} from "../api";

const tierColors: Record<string, string> = {
  高意向: "purple",
  有效跟进: "green",
  资料库: "gold",
  已转代理商: "blue",
  无效: "red",
  "撤单/流失": "default"
};

const timeScopeOptions: Array<{ value: NonNullable<CustomerFilters["timeScope"]>; label: string }> = [
  { value: "all", label: "全部历史" },
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨天" },
  { value: "date", label: "指定日期" }
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function scopeLabel(scope?: string, date?: string): string {
  if (scope === "today") return "今日";
  if (scope === "yesterday") return "昨天";
  if (scope === "date") return date ? `指定日期 ${date}` : "指定日期";
  return "全部历史";
}

export function CustomersPage() {
  const [form] = Form.useForm<CustomerFilters>();
  const [data, setData] = useState<CustomerPageResult | null>(null);
  const [nurtureTask, setNurtureTask] = useState<NurtureTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<CustomerFilters>({ page: 1, pageSize: 10, timeScope: "all" });
  const selectedTimeScope = Form.useWatch("timeScope", form);

  async function load(nextFilters: CustomerFilters = filters) {
    setLoading(true);
    try {
      const [customers, nurture] = await Promise.all([
        fetchCustomers(nextFilters),
        fetchNurtureTasks({ status: "pending", page: 1, pageSize: 1 }).catch(() => null)
      ]);
      setData(customers);
      setNurtureTask(nurture?.items[0] ?? null);
      setFilters(nextFilters);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    form.setFieldsValue({ timeScope: "all" });
    void load();
  }, []);

  const optionSource = data?.items ?? [];
  const countryOptions = useMemo(() => [...new Set(optionSource.map((item) => item.country))], [optionSource]);
  const productOptions = useMemo(() => [...new Set(optionSource.map((item) => item.product))], [optionSource]);
  const summaryCustomer = data?.items[0] ?? null;

  function applyFilters(values: CustomerFilters) {
    const nextFilters = { ...values, page: 1, pageSize: filters.pageSize ?? 10 };
    void load(nextFilters);
    message.success("客户池筛选已更新");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 客户池</Typography.Text>
          <Typography.Title level={2}>客户池列表</Typography.Title>
          <Typography.Paragraph className="muted">
            客户池沉淀客户画像、首次询盘时间、来源摘要和再营销入口；客户态势并入客户详情，不再单独占用导航。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => form.submit()}>
            筛选
          </Button>
          <Button type="primary" icon={<Check size={16} />} onClick={() => message.success("已确认当前客户池视图")}>
            确认
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="客户总数" value={data?.metrics.total_customers ?? 0} />
            <div className="metric-chip">{scopeLabel(filters.timeScope, filters.date)}</div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="高意向" value={data?.metrics.high_intent ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="有效跟进" value={data?.metrics.active_followup ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="资料库" value={data?.metrics.repository ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Form form={form} layout="inline" initialValues={{ timeScope: "all" }} onFinish={applyFilters}>
          <Form.Item name="timeScope" label="时间线">
            <Select style={{ width: 140 }} options={timeScopeOptions} />
          </Form.Item>
          {selectedTimeScope === "date" ? (
            <Form.Item name="date" label="日期">
              <Input type="date" style={{ width: 160 }} />
            </Form.Item>
          ) : null}
          <Form.Item name="country" label="国家">
            <Select allowClear placeholder="全部国家" options={countryOptions.map((country) => ({ value: country, label: country }))} />
          </Form.Item>
          <Form.Item name="product" label="产品">
            <Select allowClear placeholder="全部产品" options={productOptions.map((product) => ({ value: product, label: product }))} />
          </Form.Item>
          <Form.Item name="tier" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={["高意向", "有效跟进", "资料库", "已转代理商", "无效", "撤单/流失"].map((tier) => ({ value: tier, label: tier }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            应用
          </Button>
        </Form>
        <Typography.Text className="muted">
          当前时间线：{scopeLabel(filters.timeScope, filters.date)}。列表展示首次询盘进入时间，便于判断来源时效。
        </Typography.Text>
      </Card>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="客户摘要">
            {summaryCustomer ? (
              <>
                <Typography.Paragraph>
                  {summaryCustomer.name} · {summaryCustomer.country} · {summaryCustomer.product}
                </Typography.Paragraph>
                <div className="timeline-list">
                  <div className="timeline-item">
                    <strong>{summaryCustomer.background_summary}</strong>
                    <span>来自客户背景调查与销售反馈</span>
                  </div>
                  <div className="timeline-item">
                    <strong>首次询盘：{formatDate(summaryCustomer.first_inquiry_at)}</strong>
                    <span>{summaryCustomer.source_summary}</span>
                  </div>
                  <div className="timeline-item">
                    <strong>客户状态：{summaryCustomer.tier}</strong>
                    <span>负责人：{summaryCustomer.owner_name}</span>
                  </div>
                </div>
              </>
            ) : (
              <Empty description={data?.empty_state?.title ?? "暂无客户"} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="再营销待办入口">
            {nurtureTask ? (
              <div className="timeline-list">
                <div className="timeline-item">
                  <strong>{nurtureTask.recommended_next_action}</strong>
                  <span>建议下一步动作，来自真实 NurtureTask</span>
                </div>
                <div className="timeline-item">
                  <strong>{nurtureTask.customer_note}</strong>
                  <span>销售只能看到自己负责国家/客户范围内的待办</span>
                </div>
                <div className="tag-cluster">
                  <Tag color="purple">待确认</Tag>
                  <Tag color={nurtureTask.attachments.length ? "green" : "gold"}>{nurtureTask.attachments.length} 个参考附件</Tag>
                  <Link to={nurtureTask.detail_path}>
                    <Button type="primary" icon={<FileText size={16} />}>
                      查看邮件草稿
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Empty description="暂无待确认再营销草稿">
                <Link to="/admin/nurture">
                  <Button>查看再营销列表</Button>
                </Link>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>

      <Card className="table-card">
        <Table<CustomerListItem>
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          locale={{
            emptyText: (
              <Empty description={data?.empty_state?.title ?? "暂无客户"} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button href={data?.empty_state?.action_path ?? "/admin/leads"}>{data?.empty_state?.action_label ?? "返回线索池"}</Button>
              </Empty>
            )
          }}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.page_size ?? 10,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (page, pageSize) => void load({ ...filters, page, pageSize })
          }}
          columns={[
            { title: "首次询盘时间", dataIndex: "first_inquiry_at", fixed: "left", width: 180, render: formatDate },
            { title: "客户", dataIndex: "name", width: 180 },
            { title: "邮箱", dataIndex: "email", width: 220 },
            { title: "单位", dataIndex: "organization", width: 180 },
            { title: "国家", dataIndex: "country", width: 120 },
            { title: "产品", dataIndex: "product", width: 190 },
            { title: "来源摘要", dataIndex: "source_summary", width: 240 },
            { title: "状态", dataIndex: "tier", width: 130, render: (tier) => <Tag color={tierColors[tier] ?? "default"}>{tier}</Tag> },
            { title: "负责人", dataIndex: "owner_name", width: 150 },
            {
              title: "动作",
              key: "action",
              fixed: "right",
              width: 130,
              render: (_, record) => (
                <Link to={record.detail_path}>
                  <Button>查看详情</Button>
                </Link>
              )
            }
          ]}
          scroll={{ x: 1480 }}
        />
      </Card>
    </>
  );
}
