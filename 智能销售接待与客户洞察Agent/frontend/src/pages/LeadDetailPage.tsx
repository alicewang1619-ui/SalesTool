import { Alert, Button, Card, Col, Form, List, Row, Select, Space, Tag, Timeline, Typography, message } from "antd";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchLead,
  fetchSalesUsers,
  updateLeadAssignment,
  type LeadDetail,
  type SalesUser
} from "../api";

const scoreColor: Record<string, string> = {
  有效: "green",
  高意向: "purple",
  待补充: "orange",
  资料库: "gold"
};

const feedbackOptions = ["未反馈", "需跟进", "已联系", "已报价", "未分发"].map((value) => ({ value, label: value }));

export function LeadDetailPage() {
  const navigate = useNavigate();
  const { leadId = "" } = useParams();
  const numericLeadId = Number(leadId);
  const [form] = Form.useForm<{ ownerId: number | null; feedbackStatus: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = () => {
    if (!numericLeadId) {
      setError("线索 ID 无效");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchLead(numericLeadId), fetchSalesUsers().catch(() => [])])
      .then(([detail, users]) => {
        setLead(detail);
        setSalesUsers(users.filter((item) => item.role === "sales" && item.enabled));
        form.setFieldsValue({
          ownerId: detail.assignment.owner_id,
          feedbackStatus: detail.assignment.status
        });
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDetail();
  }, [numericLeadId]);

  async function saveAssignment(values: { ownerId: number | null; feedbackStatus: string }) {
    if (!numericLeadId) return;
    setSaving(true);
    try {
      const updated = await updateLeadAssignment(numericLeadId, values);
      setLead(updated);
      form.setFieldsValue({ ownerId: updated.assignment.owner_id, feedbackStatus: updated.assignment.status });
      message.success("分发与反馈状态已保存");
    } catch (failure) {
      message.error(failure instanceof Error ? failure.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card loading />;
  }

  if (error || !lead) {
    return (
      <Alert
        showIcon
        type="error"
        message="线索详情加载失败"
        description={error ?? "未找到线索"}
        action={
          <Button icon={<RefreshCw size={16} />} onClick={loadDetail}>
            重试
          </Button>
        }
      />
    );
  }

  return (
    <section className="lead-detail-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{lead.customer_name}</Typography.Title>
          <Typography.Paragraph className="muted">
            {lead.country} · {lead.customer_type} · {lead.product} · {lead.profile_summary.source}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/admin/leads")}>
            返回线索池
          </Button>
          {lead.customer_id ? <Link to={`/admin/customers/${lead.customer_id}`}><Button>查看客户详情</Button></Link> : null}
        </Space>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card title="评分">
            <Tag color={scoreColor[lead.score_label] ?? "default"}>{lead.score_label}</Tag>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="负责人">{lead.assignment.owner_name}</Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="反馈状态">{lead.assignment.status}</Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card title="背景任务">{lead.background_task_status}</Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Space direction="vertical" size="large" className="full-width">
            <Card title="原始询盘">
              <Typography.Paragraph>{lead.raw_inquiry}</Typography.Paragraph>
            </Card>
            <Card title="会话与 AI 判断">
              <Timeline items={lead.conversation_history.map((item) => ({ children: item }))} />
            </Card>
            <Card title="客户画像与评分理由">
              <List
                dataSource={[
                  `客户类型：${lead.profile_summary.customer_type}`,
                  `国家：${lead.profile_summary.country}`,
                  `产品兴趣：${lead.profile_summary.product}`,
                  ...lead.score_reasons
                ]}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={10}>
          <Space direction="vertical" size="large" className="full-width">
            <Card title="客户背景调查摘要">
              <Typography.Paragraph>{lead.background_summary}</Typography.Paragraph>
              <Space wrap>
                <Tag color={lead.background_confidence === "高" ? "green" : "orange"}>
                  可信度：{lead.background_confidence}
                </Tag>
                <Tag>更新时间：{lead.background_updated_at ? new Date(lead.background_updated_at).toLocaleString() : "待补充"}</Tag>
              </Space>
            </Card>

            <Card title="分发与反馈">
              <Form form={form} layout="vertical" onFinish={(values) => void saveAssignment(values)}>
                <Form.Item name="ownerId" label="销售负责人">
                  <Select
                    allowClear
                    placeholder="待分配"
                    options={salesUsers.map((item) => ({ value: item.id, label: item.name }))}
                  />
                </Form.Item>
                <Form.Item name="feedbackStatus" label="反馈状态" rules={[{ required: true }]}>
                  <Select options={feedbackOptions} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={saving} icon={<Save size={16} />}>
                  保存分发
                </Button>
              </Form>
            </Card>

            <Card title="反馈历史">
              <Timeline items={lead.feedback_history.map((item) => ({ children: item }))} />
            </Card>
          </Space>
        </Col>
      </Row>
    </section>
  );
}
