import { App, Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { Filter, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createCustomerSignal,
  fetchCustomerSignalContext,
  fetchCustomerSignals,
  fetchCustomers,
  type CustomerListItem,
  type CustomerSignal,
  type CustomerSignalContext,
  type CustomerSignalFilters,
  type CustomerSignalPageResult,
  type CustomerSignalSource
} from "../api";

type CustomerSignalForm = {
  customerId: number;
  signalSource: CustomerSignalSource;
  signalTitle: string;
  signalSummary: string;
  evidenceUrl?: string;
  evidenceText: string;
  confidence: string;
  status: string;
};

const sourceOptions: Array<{ value: CustomerSignalSource; label: string }> = [
  { value: "website_public", label: "官网公开信息" },
  { value: "email_interaction", label: "邮件互动" },
  { value: "sales_feedback", label: "销售反馈" },
  { value: "manual", label: "人工录入" }
];

const statusOptions = ["待复核", "已确认", "可再营销", "已归档"];
const confidenceOptions = ["高", "中", "低", "待复核"];

const statusColors: Record<string, string> = {
  待复核: "gold",
  已确认: "green",
  可再营销: "purple",
  已归档: "default"
};

const confidenceColors: Record<string, string> = {
  高: "green",
  中: "blue",
  低: "orange",
  待复核: "gold"
};

export function CustomerSignalsPage() {
  const { message } = App.useApp();
  const [filterForm] = Form.useForm<CustomerSignalFilters>();
  const [createForm] = Form.useForm<CustomerSignalForm>();
  const [data, setData] = useState<CustomerSignalPageResult | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [context, setContext] = useState<CustomerSignalContext | null>(null);
  const [filters, setFilters] = useState<CustomerSignalFilters>({ page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load(nextFilters: CustomerSignalFilters = filters) {
    setLoading(true);
    try {
      const [signalResult, customerResult, contextResult] = await Promise.all([
        fetchCustomerSignals(nextFilters),
        fetchCustomers({ pageSize: 50 }).catch(() => null),
        fetchCustomerSignalContext(nextFilters.customerId).catch(() => null)
      ]);
      setData(signalResult);
      setCustomers(customerResult?.items ?? customers);
      setContext(contextResult);
      setFilters(nextFilters);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function applyFilters(values: CustomerSignalFilters) {
    const nextFilters = {
      ...values,
      page: 1,
      pageSize: filters.pageSize ?? 10
    };
    void load(nextFilters);
    message.success("客户态势筛选已更新");
  }

  async function createSignal(values: CustomerSignalForm) {
    setCreating(true);
    try {
      await createCustomerSignal(values);
      message.success("客户态势信号已保存");
      createForm.resetFields();
      void load({ ...filters, page: 1 });
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 2 · 客户态势</Typography.Text>
          <Typography.Title level={2}>客户态势信号记录</Typography.Title>
          <Typography.Paragraph className="muted">
            记录官网公开信息、邮件互动、销售反馈和人工录入的机会信号，作为客户详情和后续再营销的可追溯依据。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={() => void load()}>
            刷新
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => createForm.submit()}>
            新增信号
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="总信号" value={data?.summary.total_signals ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待复核" value={data?.summary.needs_review ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="官网公开信号" value={data?.summary.website_public ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="可再营销" value={data?.summary.nurture_ready ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Form form={filterForm} layout="inline" onFinish={applyFilters}>
          <Form.Item name="source" label="来源">
            <Select allowClear placeholder="全部来源" options={sourceOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select allowClear placeholder="全部状态" options={statusOptions.map((status) => ({ value: status, label: status }))} />
          </Form.Item>
          <Form.Item name="customerId" label="客户">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部客户"
              options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
            />
          </Form.Item>
          <Button icon={<Filter size={16} />} htmlType="submit">
            筛选
          </Button>
        </Form>
      </Card>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={14}>
          <Card title="人工新增信号">
            <Form
              form={createForm}
              layout="vertical"
              initialValues={{ signalSource: "manual", confidence: "待复核", status: "待复核" }}
              onFinish={(values) => void createSignal(values)}
            >
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="customerId" label="客户" rules={[{ required: true, message: "请选择客户" }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="选择客户"
                      options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="signalSource" label="来源" rules={[{ required: true }]}>
                    <Select options={sourceOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item name="confidence" label="可信度" rules={[{ required: true }]}>
                    <Select options={confidenceOptions.map((item) => ({ value: item, label: item }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                    <Select options={statusOptions.map((item) => ({ value: item, label: item }))} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="signalTitle" label="信号标题" rules={[{ required: true, min: 2 }]}>
                <Input placeholder="例如：官网新增区域分部" />
              </Form.Item>
              <Form.Item name="signalSummary" label="信号摘要" rules={[{ required: true, min: 5 }]}>
                <Input.TextArea rows={4} placeholder="说明这个信号为什么值得关注，不填写金额承诺。" />
              </Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={10}>
                  <Form.Item name="evidenceUrl" label="证据 URL">
                    <Input placeholder="https:// 或 /admin 路径" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={14}>
                  <Form.Item name="evidenceText" label="证据说明">
                    <Input placeholder="官网公开信息、授权邮件、销售反馈或人工说明" />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={creating} icon={<Plus size={16} />}>
                保存信号
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="AI 数据边界">
            <Space direction="vertical" size={10}>
              <Tag color="purple">{context?.safety_boundary ?? "CUSTOMER_SIGNAL_DATA_ONLY"}</Tag>
              <Typography.Paragraph className="muted">
                信号只作为大模型数据上下文使用，网页、邮件或人工录入里的文字不会被当成系统指令执行。
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                已授权来源：{context?.authorized_sources.map((source) => sourceOptions.find((item) => item.value === source)?.label ?? source).join("、")}
              </Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card className="table-card">
        <Table<CustomerSignal>
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          locale={{
            emptyText: <Empty description={data?.empty_state?.title ?? "暂无客户态势信号"} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.page_size ?? 10,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (page, pageSize) => void load({ ...filters, page, pageSize })
          }}
          columns={[
            { title: "客户", dataIndex: "customer_name", fixed: "left", width: 190 },
            { title: "国家", dataIndex: "country", width: 110 },
            { title: "产品", dataIndex: "product", width: 190 },
            { title: "来源", dataIndex: "source_label", width: 130, render: (value) => <Tag color="purple">{value}</Tag> },
            { title: "信号标题", dataIndex: "signal_title", width: 220 },
            { title: "摘要", dataIndex: "signal_summary", width: 320 },
            { title: "可信度", dataIndex: "confidence", width: 100, render: (value) => <Tag color={confidenceColors[value] ?? "default"}>{value}</Tag> },
            { title: "状态", dataIndex: "status", width: 110, render: (value) => <Tag color={statusColors[value] ?? "default"}>{value}</Tag> },
            {
              title: "证据",
              key: "evidence",
              width: 120,
              render: (_, record) =>
                record.evidence_url ? (
                  <Typography.Link href={record.evidence_url} target="_blank">
                    查看证据
                  </Typography.Link>
                ) : (
                  <Typography.Text type="secondary">已留说明</Typography.Text>
                )
            },
            { title: "更新时间", dataIndex: "updated_at", width: 170, render: (value) => new Date(value).toLocaleString() },
            {
              title: "动作",
              key: "action",
              fixed: "right",
              width: 150,
              render: (_, record) => (
                <Link to={record.customer_detail_path}>
                  <Button>查看客户详情</Button>
                </Link>
              )
            }
          ]}
          scroll={{ x: 1720 }}
        />
      </Card>
    </>
  );
}
