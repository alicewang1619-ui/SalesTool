import { Alert, App, Button, Card, Col, Form, Input, Row, Space, Table, Tag, Timeline, Typography } from "antd";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCustomer, updateCustomerBackground, type Customer } from "../api";

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
      form.setFieldValue("manualSummary", updated.background.current_summary);
      message.success("客户背景调查已保存");
    } finally {
      setSaving(false);
    }
  }

  if (!customer) return <Card loading />;

  return (
    <section>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 客户池</Typography.Text>
          <Typography.Title level={2}>{customer.name}</Typography.Title>
          <Typography.Text type="secondary">
            {customer.country} · {customer.customer_type} · {customer.product}
          </Typography.Text>
        </div>
        <Space wrap>
          <Link to="/admin/customers">
            <Button icon={<ArrowLeft size={16} />}>返回客户池</Button>
          </Link>
          <Tag color={customer.background.confidence === "高" ? "green" : "orange"}>
            可信度：{customer.background.confidence}
          </Tag>
          <Tag color={customer.can_edit_background ? "purple" : "default"}>
            {customer.can_edit_background ? "可编辑背景调查" : "只读背景调查"}
          </Tag>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={6}>
          <Card title="客户分层">
            <Typography.Title level={3}>{customer.tier}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title="负责人">
            <Typography.Title level={3}>{customer.owner_name}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title="历史线索">
            <Typography.Title level={3}>{customer.lead_history.length}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card title="反馈记录">
            <Typography.Title level={3}>{customer.feedback_records.length}</Typography.Title>
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
            <Typography.Paragraph>{customer.background.auto_summary}</Typography.Paragraph>
            <Alert
              type="info"
              showIcon
              className="login-error"
              message={`最近更新：${new Date(customer.background.updated_at).toLocaleString()} · ${customer.background.updated_by}`}
            />
            <Form
              key={customer.id}
              form={form}
              layout="vertical"
              initialValues={{ manualSummary: customer.background.current_summary }}
              onFinish={(values) => void saveBackground(values)}
            >
              <Form.Item name="manualSummary" label="人工修订内容" rules={[{ required: true, min: 10 }]}>
                <Input.TextArea rows={8} disabled={!customer.can_edit_background} />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<Save size={16} />}
                loading={saving}
                disabled={!customer.can_edit_background}
              >
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
              dataSource={customer.background.sources}
              columns={[
                { title: "来源", dataIndex: "title" },
                { title: "类型", dataIndex: "type", render: (value: string) => <Tag>{value}</Tag> },
                { title: "内容", dataIndex: "detail" }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="历史线索">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={customer.lead_history}
              columns={[
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
              items={customer.timeline.map((item) => ({
                color: item.status === "background_updated" ? "purple" : "blue",
                children: (
                  <div>
                    <strong>{item.summary}</strong>
                    <div className="muted">{new Date(item.happened_at).toLocaleString()}</div>
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
          dataSource={customer.feedback_records}
          columns={[
            { title: "状态", dataIndex: "status", render: (value: string) => <Tag color="green">{value}</Tag> },
            { title: "判断", dataIndex: "judgement" },
            { title: "备注", dataIndex: "remark" },
            { title: "负责人", dataIndex: "owner_name" },
            { title: "时间", dataIndex: "happened_at", render: (value: string) => new Date(value).toLocaleString() }
          ]}
        />
      </Card>
    </section>
  );
}
