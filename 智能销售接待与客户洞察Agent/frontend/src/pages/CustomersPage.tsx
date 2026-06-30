import { Button, Card, Col, Empty, Form, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
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

export function CustomersPage() {
  const [form] = Form.useForm<CustomerFilters>();
  const [data, setData] = useState<CustomerPageResult | null>(null);
  const [nurtureTask, setNurtureTask] = useState<NurtureTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<CustomerFilters>({ page: 1, pageSize: 10 });

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
    void load();
  }, []);

  const optionSource = data?.items ?? [];
  const countryOptions = useMemo(() => [...new Set(optionSource.map((item) => item.country))], [optionSource]);
  const productOptions = useMemo(() => [...new Set(optionSource.map((item) => item.product))], [optionSource]);
  const summaryCustomer = data?.items[0] ?? null;

  function applyFilters(values: CustomerFilters) {
    void load({ ...values, page: 1, pageSize: filters.pageSize ?? 10 });
    message.success("筛选已更新");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1(MVP) · 客户池</Typography.Text>
          <Typography.Title level={2}>客户池列表</Typography.Title>
          <Typography.Paragraph className="muted">
            按高意向、有效跟进、资料库、已转代理商、无效和撤单/流失等状态沉淀客户。
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
        <Form form={form} layout="inline" onFinish={applyFilters}>
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
        </Form>
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
                    <span>来源于客户背景调查与销售反馈</span>
                  </div>
                  <div className="timeline-item">
                    <strong>客户状态：{summaryCustomer.tier}</strong>
                    <span>负责人：{summaryCustomer.owner_name}</span>
                  </div>
                  <div className="timeline-item">
                    <strong>进入客户详情继续修订背景调查</strong>
                    <span>{summaryCustomer.detail_path}</span>
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
                  <span>客户备注；草稿详情页可继续编辑提示词和附件</span>
                </div>
                <div className="tag-cluster">
                  <Tag color="purple">待确认</Tag>
                  <Tag color={nurtureTask.attachments.length ? "green" : "gold"}>{nurtureTask.attachments.length} 附件</Tag>
                  <Link to={nurtureTask.detail_path}>
                    <Button type="primary" icon={<FileText size={16} />}>
                      查看草稿
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
                <Button href={data?.empty_state?.action_path ?? "/admin/leads"}>
                  {data?.empty_state?.action_label ?? "返回线索池"}
                </Button>
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
            { title: "客户", dataIndex: "name", fixed: "left", width: 190 },
            { title: "国家", dataIndex: "country", width: 120 },
            { title: "类型", dataIndex: "customer_type", width: 130 },
            { title: "产品", dataIndex: "product", width: 190 },
            { title: "评分", dataIndex: "tier", width: 130, render: (tier) => <Tag color={tierColors[tier] ?? "default"}>{tier}</Tag> },
            { title: "反馈", dataIndex: "owner_name", width: 150 },
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
          scroll={{ x: 1040 }}
        />
      </Card>
    </>
  );
}
