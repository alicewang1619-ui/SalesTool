import { Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { Mail, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCustomers, type CustomerFilters, type CustomerListItem, type CustomerPageResult } from "../api";

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

function bulkEmailPath(filters: CustomerFilters): string {
  const params = new URLSearchParams({ tab: "bulk" });
  if (filters.country) params.set("country", filters.country);
  if (filters.product) params.set("product", filters.product);
  if (filters.tier) params.set("tier", filters.tier);
  return `/admin/nurture?${params.toString()}`;
}

export function CustomersPage() {
  const [form] = Form.useForm<CustomerFilters>();
  const [data, setData] = useState<CustomerPageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<CustomerFilters>({ page: 1, pageSize: 10, timeScope: "all" });
  const selectedTimeScope = Form.useWatch("timeScope", form);
  const role = window.localStorage.getItem("ug_role") || "";
  const canBulkEmail = role === "admin" || role === "ops";

  async function load(nextFilters: CustomerFilters = filters) {
    setLoading(true);
    try {
      const customers = await fetchCustomers(nextFilters);
      setData(customers);
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
            客户池是客户管理列表；态势、建议动作和再营销入口都放到客户详情里处理。
          </Typography.Paragraph>
        </div>
        {canBulkEmail ? (
          <Link to={bulkEmailPath(filters)}>
            <Button type="primary" icon={<Mail size={16} />}>筛选后群发</Button>
          </Link>
        ) : null}
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={6}><Card><Statistic title="客户总数" value={data?.metrics.total_customers ?? 0} /><div className="metric-chip">{scopeLabel(filters.timeScope, filters.date)}</div></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="高意向" value={data?.metrics.high_intent ?? 0} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="有效跟进" value={data?.metrics.active_followup ?? 0} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="资料库" value={data?.metrics.repository ?? 0} /></Card></Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Form form={form} layout="inline" initialValues={{ timeScope: "all" }} onFinish={applyFilters}>
          <Form.Item name="timeScope" label="时间线"><Select style={{ width: 140 }} options={timeScopeOptions} /></Form.Item>
          {selectedTimeScope === "date" ? <Form.Item name="date" label="日期"><Input type="date" style={{ width: 160 }} /></Form.Item> : null}
          <Form.Item name="country" label="国家">
            <Select allowClear placeholder="全部国家" options={countryOptions.map((country) => ({ value: country, label: country }))} />
          </Form.Item>
          <Form.Item name="product" label="产品">
            <Select allowClear placeholder="全部产品" options={productOptions.map((product) => ({ value: product, label: product }))} />
          </Form.Item>
          <Form.Item name="tier" label="状态">
            <Select allowClear placeholder="全部状态" options={["高意向", "有效跟进", "资料库", "已转代理商", "无效", "撤单/流失"].map((tier) => ({ value: tier, label: tier }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<Search size={16} />}>应用</Button>
        </Form>
        <Typography.Text className="muted">
          当前时间线：{scopeLabel(filters.timeScope, filters.date)}。列表展示首次询盘进入时间，便于判断来源时效。
        </Typography.Text>
      </Card>

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
            { title: "邮箱", dataIndex: "email", width: 220, render: (value: string) => value || "—" },
            { title: "单位", dataIndex: "organization", width: 180, render: (value: string) => value || "—" },
            { title: "国家", dataIndex: "country", width: 120 },
            { title: "产品", dataIndex: "product", width: 190 },
            { title: "来源摘要", dataIndex: "source_summary", width: 240 },
            { title: "状态", dataIndex: "tier", width: 130, render: (tier: string) => <Tag color={tierColors[tier] ?? "default"}>{tier}</Tag> },
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
