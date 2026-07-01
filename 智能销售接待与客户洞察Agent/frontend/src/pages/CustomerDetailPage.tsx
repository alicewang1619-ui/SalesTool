import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Row, Space, Table, Tag, Timeline, Typography } from "antd";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCustomer, updateCustomerBackground, type Customer } from "../api";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const fallbackBackground: Customer["background"] = {
  auto_summary: "暂无背景调查",
  manual_summary: null,
  current_summary: "暂无背景调查",
  evidence: "",
  sources: [],
  confidence: "待复核",
  updated_by: "系统",
  updated_at: ""
};

export function CustomerDetailPage() {
  const { message } = App.useApp();
  const { customerId = "1" } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ manualSummary: string }>();

  useEffect(() => {
    let alive = true;
    setCustomer(null);
    void fetchCustomer(customerId).then((item) => {
      if (!alive) return;
      setCustomer(item);
    });
    return () => {
      alive = false;
    };
  }, [customerId]);

  async function saveBackground(values: { manualSummary: string }): Promise<void> {
    setSaving(true);
    try {
      const updated = await updateCustomerBackground(customerId, values.manualSummary);
      setCustomer(updated);
      form.setFieldValue("manualSummary", updated.background?.current_summary ?? values.manualSummary);
      message.success("客户背景调查已保存");
    } finally {
      setSaving(false);
    }
  }

  if (!customer) return <Card loading />;

  const background = customer.background ?? fallbackBackground;
  const leadHistory = customer.lead_history ?? [];
  const feedbackRecords = customer.feedback_records ?? [];
  const timeline = customer.timeline ?? [];
  const signals = customer.signals ?? [];
  const canEditBackground = Boolean(customer.can_edit_background);

  return (
    <section>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 客户池</Typography.Text>
          <Typography.Title level={2}>{customer.name}</Typography.Title>
          <Typography.Text type="secondary">
            {customer.country} · {customer.customer_type} · {customer.product}
          </Typography.Text>
        </div>
        <Space wrap>
          <Link to="/admin/customers">
            <Button icon={<ArrowLeft size={16} />}>返回客户池</Button>
          </Link>
          <Tag color="purple">{customer.tier}</Tag>
          <Tag color={canEditBackground ? "purple" : "default"}>
            {canEditBackground ? "可编辑背景调查" : "只读背景调查"}
          </Tag>
        </Space>
      </div>

      <Card title="客户基本信息">
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }}>
          <Descriptions.Item label="姓名">{customer.name}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{customer.email || "—"}</Descriptions.Item>
          <Descriptions.Item label="单位">{customer.organization || "—"}</Descriptions.Item>
          <Descriptions.Item label="国家">{customer.country}</Descriptions.Item>
          <Descriptions.Item label="产品">{customer.product}</Descriptions.Item>
          <Descriptions.Item label="负责人">{customer.owner_name}</Descriptions.Item>
          <Descriptions.Item label="首次询盘时间">{formatDate(customer.first_inquiry_at)}</Descriptions.Item>
          <Descriptions.Item label="来源摘要">{customer.source_summary || "—"}</Descriptions.Item>
          <Descriptions.Item label="客户分层">{customer.tier}</Descriptions.Item>
        </Descriptions>
        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col xs={24} lg={12}>
            <Alert type="info" showIcon message="询盘要求 / 客户需求" description={customer.demand_summary || "暂无需求摘要"} />
          </Col>
          <Col xs={24} lg={12}>
            <Alert type="success" showIcon message="客户背景调查摘要" description={background.current_summary} />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={6}>
          <Card title="历史线索">
            <Typography.Title level={3}>{leadHistory.length}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title="反馈记录">
            <Typography.Title level={3}>{feedbackRecords.length}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title="态势信号">
            <Typography.Title level={3}>{signals.length}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title="背景可信度">
            <Typography.Title level={3}>{background.confidence}</Typography.Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ShieldCheck size={18} />
                客户背景调查
              </Space>
            }
          >
            <Typography.Paragraph>{background.auto_summary}</Typography.Paragraph>
            <Alert
              type="info"
              showIcon
              className="login-error"
              message={`最近更新：${formatDate(background.updated_at)} · ${background.updated_by}`}
            />
            <Form
              key={customer.id}
              form={form}
              layout="vertical"
              initialValues={{ manualSummary: background.current_summary }}
              onFinish={(values) => void saveBackground(values)}
            >
              <Form.Item name="manualSummary" label="人工修订内容" rules={[{ required: true, min: 10 }]}>
                <Input.TextArea rows={8} disabled={!canEditBackground} />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={saving} disabled={!canEditBackground}>
                保存人工修订
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="调查来源与证据">
            <Table
              rowKey={(record) => `${record.type}-${record.title}`}
              size="small"
              pagination={false}
              dataSource={background.sources}
              columns={[
                { title: "来源", dataIndex: "title" },
                { title: "类型", dataIndex: "type", render: (value: string) => <Tag>{value}</Tag> },
                { title: "内容", dataIndex: "detail" }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="客户态势信号" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={signals}
          columns={[
            { title: "观察时间", dataIndex: "observed_at", width: 180, render: formatDate },
            { title: "信号标题", dataIndex: "signal_title", width: 220 },
            { title: "来源", dataIndex: "source_label", width: 160 },
            { title: "摘要", dataIndex: "signal_summary" },
            { title: "可信度", dataIndex: "confidence", width: 110, render: (value: string) => <Tag color="purple">{value}</Tag> },
            { title: "状态", dataIndex: "status", width: 130, render: (value: string) => <Tag color="green">{value}</Tag> }
          ]}
          scroll={{ x: 980 }}
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="历史线索">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={leadHistory}
              columns={[
                { title: "进入时间", dataIndex: "created_at", render: formatDate },
                { title: "来源", dataIndex: "source" },
                { title: "产品", dataIndex: "product" },
                { title: "负责人", dataIndex: "owner_name" },
                { title: "反馈", dataIndex: "feedback_status", render: (value: string) => <Tag color="purple">{value}</Tag> }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="状态时间线">
            <Timeline
              items={timeline.map((item) => ({
                color: item.status === "background_updated" ? "purple" : "blue",
                children: (
                  <div>
                    <strong>{item.summary}</strong>
                    <div className="muted">{formatDate(item.happened_at)}</div>
                  </div>
                )
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card title="销售反馈记录" style={{ marginTop: 16 }}>
        <Table
          rowKey={(record) => `${record.status}-${record.happened_at}`}
          pagination={false}
          dataSource={feedbackRecords}
          columns={[
            { title: "状态", dataIndex: "status", render: (value: string) => <Tag color="green">{value}</Tag> },
            { title: "判断", dataIndex: "judgement" },
            { title: "备注", dataIndex: "remark" },
            { title: "负责人", dataIndex: "owner_name" },
            { title: "时间", dataIndex: "happened_at", render: formatDate }
          ]}
        />
      </Card>
    </section>
  );
}
