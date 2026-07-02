import { App, Button, Card, Col, Descriptions, Empty, Form, Input, Rate, Row, Space, Table, Tag, Timeline, Typography } from "antd";
import { ArrowLeft, FileText, Save, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createNurtureTask,
  fetchCustomer,
  fetchNurtureTasks,
  updateCustomerBackground,
  type Customer,
  type ScoreSummary,
  type NurtureTask
} from "../api";

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

const fallbackScore: ScoreSummary = {
  total: 0,
  max_score: 5,
  label: "待评分",
  dimensions: [
    { key: "information_completeness", label: "信息完整性", earned: false, point: 1, reason: "暂无足够信息，等待补全。" },
    { key: "industry_relevance", label: "行业相关", earned: false, point: 1, reason: "暂无足够信息，等待补全。" },
    { key: "clear_need", label: "明确需求", earned: false, point: 1, reason: "暂无足够信息，等待补全。" },
    { key: "customer_qualification", label: "客户资质与采购能力", earned: false, point: 1, reason: "暂无足够信息，等待补全。" },
    { key: "reachable_next_step", label: "触达与推进可行性", earned: false, point: 1, reason: "暂无足够信息，等待补全。" }
  ]
};

export function CustomerDetailPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { customerId = "1" } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [nurtureTask, setNurtureTask] = useState<NurtureTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingNurture, setCreatingNurture] = useState(false);
  const [form] = Form.useForm<{ manualSummary: string }>();

  useEffect(() => {
    let alive = true;
    setCustomer(null);
    setNurtureTask(null);
    void Promise.all([
      fetchCustomer(customerId),
      fetchNurtureTasks({ status: "pending", customerId: Number(customerId), page: 1, pageSize: 1 }).catch(() => null)
    ]).then(([item, tasks]) => {
      if (!alive) return;
      setCustomer(item);
      setNurtureTask((tasks?.items ?? []).find((task) => task.customer_id === item.id) ?? null);
      form.setFieldValue("manualSummary", item.background?.current_summary ?? "");
    });
    return () => {
      alive = false;
    };
  }, [customerId, form]);

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

  async function launchNurture(): Promise<void> {
    if (!customer) return;
    if (nurtureTask) {
      navigate(nurtureTask.detail_path);
      return;
    }
    setCreatingNurture(true);
    try {
      const task = await createNurtureTask(customer.id);
      setNurtureTask(task);
      message.success("已创建再营销邮件草稿");
      navigate(task.detail_path);
    } finally {
      setCreatingNurture(false);
    }
  }

  if (!customer) return <Card loading />;

  const background = customer.background ?? fallbackBackground;
  const leadHistory = customer.lead_history ?? [];
  const feedbackRecords = customer.feedback_records ?? [];
  const timeline = customer.timeline ?? [];
  const signals = customer.signals ?? [];
  const canEditBackground = Boolean(customer.can_edit_background);
  const score = customer.score_summary ?? fallbackScore;
  const scoreDimensions = score.dimensions?.length ? score.dimensions : fallbackScore.dimensions;

  return (
    <section>
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>{customer.name}</Typography.Title>
          <Typography.Text type="secondary">
            {customer.country} · {customer.customer_type} · {customer.product}
          </Typography.Text>
        </div>
        <Space wrap>
          <Link to="/admin/customers">
            <Button icon={<ArrowLeft size={16} />}>返回客户池</Button>
          </Link>
          <Button type="primary" icon={<Send size={16} />} loading={creatingNurture} onClick={() => void launchNurture()}>
            发起再营销
          </Button>
          <Tag color="purple">{customer.tier}</Tag>
          <Tag color={canEditBackground ? "purple" : "default"}>{canEditBackground ? "可编辑背景调查" : "只读背景调查"}</Tag>
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
            <div className="config-detail-card compact">
              <Typography.Text strong>询盘要求 / 客户需求</Typography.Text>
              <Typography.Paragraph className="muted">{customer.demand_summary || "暂无需求摘要"}</Typography.Paragraph>
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <div className="config-detail-card compact">
              <Typography.Text strong>客户背景调查摘要</Typography.Text>
              <Typography.Paragraph className="muted">{background.current_summary}</Typography.Paragraph>
            </div>
          </Col>
        </Row>
      </Card>

      <Card title="AI 五星评分" style={{ marginTop: 16 }}>
        <Space wrap align="center">
          <Rate disabled count={score.max_score || fallbackScore.max_score} value={score.total} />
          <Tag color={score.total >= 4 ? "green" : score.total >= 3 ? "purple" : "gold"}>{score.label}</Tag>
          <Typography.Text type="secondary">每个维度 1 分，用于运营判断询盘质量。</Typography.Text>
        </Space>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={scoreDimensions}
          style={{ marginTop: 12 }}
          columns={[
            { title: "评分维度", dataIndex: "label", width: 180 },
            { title: "得分", dataIndex: "earned", width: 100, render: (earned: boolean) => <Tag color={earned ? "green" : "default"}>{earned ? "1 分" : "0 分"}</Tag> },
            { title: "AI 判断理由", dataIndex: "reason" }
          ]}
        />
      </Card>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={6}><Card title="历史线索"><Typography.Title level={3}>{leadHistory.length}</Typography.Title></Card></Col>
        <Col xs={24} md={6}><Card title="反馈记录"><Typography.Title level={3}>{feedbackRecords.length}</Typography.Title></Card></Col>
        <Col xs={24} md={6}><Card title="态势信号"><Typography.Title level={3}>{signals.length}</Typography.Title></Card></Col>
        <Col xs={24} md={6}><Card title="背景可信度"><Typography.Title level={3}>{background.confidence}</Typography.Title></Card></Col>
      </Row>

      <Card title="建议动作与主动再营销" style={{ marginTop: 16 }}>
        {nurtureTask ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <div className="subtle-note">
              <Typography.Text strong>{nurtureTask.recommended_next_action}</Typography.Text>
              <Typography.Text className="muted">{nurtureTask.customer_note}</Typography.Text>
            </div>
            <Space wrap>
              <Tag color="purple">{nurtureTask.approval_status === "pending" ? "待确认" : nurtureTask.approval_status}</Tag>
              <Tag>{nurtureTask.email_status === "sent" ? "已发送" : "邮件草稿"}</Tag>
              <Tag color={nurtureTask.attachments.length ? "green" : "gold"}>{nurtureTask.attachments.length} 个参考附件</Tag>
              <Link to={nurtureTask.detail_path}>
                <Button type="primary" icon={<FileText size={16} />}>查看邮件草稿</Button>
              </Link>
            </Space>
          </Space>
        ) : (
          <Empty description="暂无 AI 建议动作，也可以主动为该客户创建再营销邮件" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" icon={<Send size={16} />} loading={creatingNurture} onClick={() => void launchNurture()}>
              创建再营销邮件
            </Button>
          </Empty>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={<Space><ShieldCheck size={18} />客户背景调查</Space>}>
            <Typography.Paragraph>{background.auto_summary}</Typography.Paragraph>
            <Typography.Paragraph className="muted">最近更新：{formatDate(background.updated_at)} · {background.updated_by}</Typography.Paragraph>
            <Form key={customer.id} form={form} layout="vertical" initialValues={{ manualSummary: background.current_summary }} onFinish={(values) => void saveBackground(values)}>
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
            { title: "来源", dataIndex: "source_label", width: 140 },
            { title: "标题", dataIndex: "signal_title", width: 220 },
            { title: "摘要", dataIndex: "signal_summary" },
            { title: "状态", dataIndex: "status", width: 120, render: (value: string) => <Tag color="purple">{value}</Tag> }
          ]}
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="历史线索">
            <Table
              rowKey="id"
              pagination={false}
              dataSource={leadHistory}
              columns={[
                { title: "时间", dataIndex: "created_at", render: formatDate },
                { title: "来源", dataIndex: "source" },
                { title: "产品", dataIndex: "product" },
                { title: "状态", dataIndex: "feedback_status", render: (value: string) => <Tag>{value}</Tag> },
                { title: "负责人", dataIndex: "owner_name" }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="反馈记录">
            <Table
              rowKey={(record) => `${record.happened_at}-${record.owner_name}`}
              pagination={false}
              dataSource={feedbackRecords}
              columns={[
                { title: "时间", dataIndex: "happened_at", render: formatDate },
                { title: "状态", dataIndex: "status", render: (value: string) => <Tag color="purple">{value}</Tag> },
                { title: "销售判断", dataIndex: "judgement" },
                { title: "备注", dataIndex: "remark" },
                { title: "负责人", dataIndex: "owner_name" }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="客户时间线" style={{ marginTop: 16 }}>
        <Timeline
          items={timeline.map((item) => ({
            color: item.status.includes("background") ? "blue" : "purple",
            children: (
              <Space direction="vertical" size={2}>
                <Typography.Text>{item.summary}</Typography.Text>
                <Typography.Text type="secondary">{formatDate(item.happened_at)}</Typography.Text>
              </Space>
            )
          }))}
        />
      </Card>
    </section>
  );
}
