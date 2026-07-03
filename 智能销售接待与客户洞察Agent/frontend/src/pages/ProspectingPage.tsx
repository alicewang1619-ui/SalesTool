import { App, Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Check, ExternalLink, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  confirmProspectCandidate,
  createProspectingPlan,
  discardProspectCandidate,
  fetchProspectingOverview,
  type ProspectCandidate,
  type ProspectingOverview,
  type ProspectingPlanInput
} from "../api";

const channelOptions = [
  { value: "Google", label: "Google" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Google Maps", label: "Google Maps" },
  { value: "Manual", label: "Manual" }
];

const statusColor: Record<string, string> = {
  待确认: "purple",
  已入库: "green",
  已丢弃: "default"
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function ProspectingPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ProspectingPlanInput>();
  const [overview, setOverview] = useState<ProspectingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);

  const latestPlan = useMemo(() => overview?.plans[0] ?? null, [overview]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const result = await fetchProspectingOverview();
      setOverview(result);
    } catch (failure) {
      message.error(failure instanceof Error ? failure.message : "加载挖潜客数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      await createProspectingPlan({
        brand_name: values.brand_name.trim(),
        product_focus: values.product_focus.trim(),
        target_region: values.target_region.trim(),
        target_customer_profile: values.target_customer_profile.trim(),
        channels: values.channels?.length ? values.channels : ["Google", "LinkedIn", "Google Maps"]
      });
      message.success("已生成拓客方案和候选潜客");
      await loadOverview();
    } catch (failure) {
      message.error(failure instanceof Error ? failure.message : "生成拓客方案失败");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = async (candidate: ProspectCandidate) => {
    setActiveCandidateId(candidate.id);
    try {
      const result = await confirmProspectCandidate(candidate.id);
      message.success(`${candidate.company_name} 已进入线索池`);
      await loadOverview();
      navigate(result.customer_detail_path);
    } catch (failure) {
      message.error(failure instanceof Error ? failure.message : "候选潜客入库失败");
    } finally {
      setActiveCandidateId(null);
    }
  };

  const handleDiscard = async (candidate: ProspectCandidate) => {
    setActiveCandidateId(candidate.id);
    try {
      await discardProspectCandidate(candidate.id);
      message.success(`${candidate.company_name} 已丢弃`);
      await loadOverview();
    } catch (failure) {
      message.error(failure instanceof Error ? failure.message : "候选潜客丢弃失败");
    } finally {
      setActiveCandidateId(null);
    }
  };

  const columns: ColumnsType<ProspectCandidate> = [
    {
      title: "候选客户",
      dataIndex: "company_name",
      key: "company_name",
      width: 220,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{record.organization || "待核验单位"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "国家",
      dataIndex: "country",
      key: "country",
      width: 120
    },
    {
      title: "来源",
      key: "source",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color="purple">{record.source_channel}</Tag>
          <Typography.Text type="secondary">{record.source_label}</Typography.Text>
        </Space>
      )
    },
    {
      title: "来源链接",
      dataIndex: "source_url",
      key: "source_url",
      width: 170,
      render: (value: string) => (
        <Button type="link" href={value} target="_blank" rel="noreferrer" icon={<ExternalLink size={16} />} className="table-link-button">
          打开来源
        </Button>
      )
    },
    {
      title: "来源说明",
      dataIndex: "source_note",
      key: "source_note",
      ellipsis: true
    },
    {
      title: "AI 匹配理由",
      dataIndex: "ai_match_reason",
      key: "ai_match_reason",
      ellipsis: true
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => <Tag color={statusColor[value] ?? "default"}>{value}</Tag>
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 190,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<Check size={14} />}
            disabled={record.status !== "待确认"}
            loading={activeCandidateId === record.id}
            onClick={() => void handleConfirm(record)}
          >
            确认入库
          </Button>
          <Button
            danger
            size="small"
            icon={<Trash2 size={14} />}
            disabled={record.status !== "待确认"}
            onClick={() => void handleDiscard(record)}
          >
            丢弃
          </Button>
        </Space>
      )
    }
  ];

  return (
    <section className="prospecting-page">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>挖潜客</Typography.Title>
          <Typography.Paragraph className="muted">
            根据品牌、区域和目标客户画像生成拓客方案；候选客户确认后进入线索池，并保留来源链接。
          </Typography.Paragraph>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={() => void loadOverview()} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="候选潜客" value={overview?.metrics.total_candidates ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="待确认" value={overview?.metrics.pending_candidates ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已入库" value={overview?.metrics.confirmed_candidates ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="已丢弃" value={overview?.metrics.discarded_candidates ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="section-grid">
        <Col xs={24} lg={10}>
          <Card title="拓客方案">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                brand_name: "CHISON Ultrasound",
                product_focus: "Portable Ultrasound",
                target_region: "Peru",
                target_customer_profile: "区域医疗设备代理商、影像设备渠道商、移动诊所采购决策人",
                channels: ["Google", "LinkedIn", "Google Maps"]
              }}
            >
              <Form.Item name="brand_name" label="品牌" rules={[{ required: true, message: "请填写品牌" }]}>
                <Input placeholder="例如 CHISON Ultrasound" />
              </Form.Item>
              <Form.Item name="product_focus" label="产品侧重点" rules={[{ required: true, message: "请填写产品侧重点" }]}>
                <Input placeholder="例如 Portable Ultrasound" />
              </Form.Item>
              <Form.Item name="target_region" label="目标区域" rules={[{ required: true, message: "请填写目标区域" }]}>
                <Input placeholder="例如 Peru / UAE / Southeast Asia" />
              </Form.Item>
              <Form.Item name="target_customer_profile" label="目标客户画像" rules={[{ required: true, message: "请填写目标客户画像" }]}>
                <Input.TextArea rows={4} placeholder="例如区域代理商、医院采购、影像设备渠道商" />
              </Form.Item>
              <Form.Item name="channels" label="拓客渠道" rules={[{ required: true, message: "请选择拓客渠道" }]}>
                <Select mode="multiple" options={channelOptions} />
              </Form.Item>
              <Button type="primary" icon={<Search size={16} />} loading={creating} onClick={() => void handleCreate()}>
                生成拓客方案
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="AI 拓客方案与渠道节奏">
            {latestPlan ? (
              <Space direction="vertical" size={16} className="full-width">
                <Space wrap>
                  <Tag color="purple">{latestPlan.brand_name}</Tag>
                  <Tag color="blue">{latestPlan.product_focus}</Tag>
                  <Tag>{latestPlan.target_region}</Tag>
                  {latestPlan.channels.map((channel) => (
                    <Tag key={channel}>{channel}</Tag>
                  ))}
                </Space>
                <Typography.Paragraph>{latestPlan.ai_strategy}</Typography.Paragraph>
                <Typography.Paragraph className="muted">{latestPlan.cadence_plan}</Typography.Paragraph>
                <Typography.Text type="secondary">最近生成：{formatDate(latestPlan.created_at)}</Typography.Text>
              </Space>
            ) : (
              <Empty description="还没有拓客方案，先填写左侧表单生成一批候选潜客。" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="候选潜客" className="table-card">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={overview?.candidates ?? []}
          scroll={{ x: 1360 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="暂无候选潜客" /> }}
        />
      </Card>
    </section>
  );
}
