import { Alert, Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from "antd";
import { CheckCircle2, FileText, Filter, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createBulkEmailCampaign,
  fetchNurtureTasks,
  previewBulkEmailCampaign,
  type BulkEmailFilters,
  type BulkEmailPreview,
  type NurtureTask,
  type NurtureTaskPageResult
} from "../api";

const statusLabels: Record<string, string> = {
  pending: "待确认",
  confirmed: "已确认",
  cancelled: "已取消"
};

const statusColors: Record<string, string> = {
  pending: "purple",
  confirmed: "green",
  cancelled: "default"
};

const emailStatusLabels: Record<string, string> = {
  draft: "草稿",
  pending: "待发送",
  sent: "已发送"
};

type BulkEmailFormValues = BulkEmailFilters & {
  subject?: string;
  body?: string;
};

function compactFilters(values: BulkEmailFormValues): BulkEmailFilters {
  return {
    country: values.country || null,
    product: values.product || null,
    tier: values.tier || null,
    customerType: values.customerType || null,
    sourceQuery: values.sourceQuery || null,
    feedbackStatus: values.feedbackStatus || null
  };
}

function initialBulkValues(searchParams: URLSearchParams): BulkEmailFormValues {
  return {
    country: searchParams.get("country") || undefined,
    product: searchParams.get("product") || undefined,
    tier: searchParams.get("tier") || undefined,
    subject: "Ultrasound product update",
    body: "Hi, we prepared a short product update and would like to confirm your current ultrasound needs."
  };
}

export function NurtureTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<NurtureTaskPageResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "bulk" ? "bulk" : "tasks");
  const role = window.localStorage.getItem("ug_role") || "";
  const canBulkEmail = role === "admin" || role === "ops";
  const bulkInitialValues = useMemo(() => initialBulkValues(searchParams), [searchParams]);

  async function load(page = 1, pageSize = 10, status = statusFilter) {
    setLoading(true);
    try {
      const result = await fetchNurtureTasks({ page, pageSize, status });
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function applyStatus(nextStatus?: string) {
    setStatusFilter(nextStatus);
    void load(1, data?.page_size ?? 10, nextStatus);
    message.success("再营销筛选已更新");
  }

  function changeTab(tab: string) {
    setActiveTab(tab);
    setSearchParams(tab === "bulk" ? { tab: "bulk" } : {});
  }

  const taskContent = (
    <>
      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={8}><Card><Statistic title="待确认草稿" value={data?.summary.pending ?? 0} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="已确认" value={data?.summary.confirmed ?? 0} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="带参考附件" value={data?.summary.with_attachments ?? 0} /></Card></Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Space wrap>
          <Select
            allowClear
            placeholder="全部草稿状态"
            value={statusFilter}
            onChange={applyStatus}
            options={[
              { value: "pending", label: "待确认" },
              { value: "confirmed", label: "已确认" },
              { value: "cancelled", label: "已取消" }
            ]}
            style={{ width: 180 }}
          />
          <Button icon={<Filter size={16} />} onClick={() => void load(1, data?.page_size ?? 10)}>刷新</Button>
        </Space>
        <Typography.Text className="muted">
          附件默认作为 AI 写邮件的参考素材；是否随邮件发送需要在详情页人工确认。
        </Typography.Text>
      </Card>

      <Card className="table-card">
        <Table<NurtureTask>
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          locale={{ emptyText: <Empty description={data?.empty_state?.title ?? "暂无再营销任务"} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.page_size ?? 10,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (page, pageSize) => void load(page, pageSize)
          }}
          columns={[
            { title: "客户", dataIndex: "customer_name", fixed: "left", width: 180 },
            { title: "客户分层", dataIndex: "customer_tier", width: 120, render: (tier: string) => <Tag color="purple">{tier}</Tag> },
            { title: "发件人", dataIndex: "sender_email", width: 220 },
            { title: "收件人", dataIndex: "recipient_email", width: 220 },
            { title: "邮件主题", dataIndex: "email_subject", width: 240 },
            { title: "建议动作", dataIndex: "recommended_next_action", width: 280 },
            {
              title: "提示词/附件",
              key: "prompt",
              width: 150,
              render: (_, record) => (
                <Space size={6}>
                  <Tag color={record.generation_prompt ? "blue" : "default"}>提示词</Tag>
                  <Tag color={record.attachments.length ? "green" : "gold"}>{record.attachments.length} 附件</Tag>
                </Space>
              )
            },
            { title: "邮件状态", dataIndex: "email_status", width: 110, render: (status: string) => <Tag color={status === "sent" ? "green" : "gold"}>{emailStatusLabels[status] ?? status}</Tag> },
            { title: "草稿状态", dataIndex: "approval_status", width: 120, render: (status: string) => <Tag color={statusColors[status] ?? "default"}>{statusLabels[status] ?? status}</Tag> },
            {
              title: "动作",
              key: "action",
              fixed: "right",
              width: 140,
              render: (_, record) => (
                <Link to={record.detail_path}>
                  <Button icon={<FileText size={16} />}>查看草稿</Button>
                </Link>
              )
            }
          ]}
          scroll={{ x: 1780 }}
        />
      </Card>
    </>
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 2 · 再营销</Typography.Text>
          <Typography.Title level={2}>再营销与邮件活动</Typography.Title>
          <Typography.Paragraph className="muted">
            再营销待办用于单个客户邮件草稿确认；群发邮件用于运营/管理员按客户类型或活动筛选批量触达。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => void load(1, data?.page_size ?? 10)}>刷新</Button>
          <Button type="primary" icon={<CheckCircle2 size={16} />}>人工确认队列</Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: "tasks", label: "再营销待办", children: taskContent },
          ...(canBulkEmail ? [{ key: "bulk", label: "群发邮件", children: <BulkEmailPanel initialValues={bulkInitialValues} /> }] : [])
        ]}
      />
    </>
  );
}

function BulkEmailPanel({ initialValues }: { initialValues: BulkEmailFormValues }) {
  const [form] = Form.useForm<BulkEmailFormValues>();
  const [preview, setPreview] = useState<BulkEmailPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  async function handlePreview() {
    const values = form.getFieldsValue();
    setLoadingPreview(true);
    try {
      const result = await previewBulkEmailCampaign(compactFilters(values));
      setPreview(result);
      message.success(`已匹配 ${result.target_count} 个客户`);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleCreate(values: BulkEmailFormValues) {
    setCreating(true);
    try {
      const campaign = await createBulkEmailCampaign({
        filters: compactFilters(values),
        subject: values.subject ?? "",
        body: values.body ?? ""
      });
      message.success(`群发邮件活动已创建，目标客户 ${campaign.target_count} 个`);
      await handlePreview();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card title="群发邮件 / 邮件活动" extra={<Button icon={<Mail size={16} />} loading={loadingPreview} onClick={() => void handlePreview()}>预览收件人</Button>}>
      <Alert
        type="info"
        showIcon
        className="login-error"
        message="权限与用途"
        description="群发邮件仅管理员和运营可用，用于新导入客户开发信、促销活动或指定客户类型批量触达；销售只处理自己负责客户的单客再营销。"
      />
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={(values) => void handleCreate(values)}>
        <Row gutter={16}>
          <Col xs={24} md={8}><Form.Item name="country" label="国家"><Input placeholder="例如 Peru / China" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="product" label="产品"><Input placeholder="例如 Portable Ultrasound" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="tier" label="客户分层"><Select allowClear options={["高意向", "有效跟进", "资料库", "已转代理商", "无效", "撤单/流失"].map((item) => ({ value: item, label: item }))} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="customerType" label="客户类型"><Input placeholder="Clinic / Hospital / 代理商" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="sourceQuery" label="来源关键词"><Input placeholder="官网聊天 / 展会 / 邮箱" /></Form.Item></Col>
          <Col xs={24} md={8}>
            <Form.Item name="feedbackStatus" label="销售状态">
              <Select allowClear options={["未分配", "无效", "跟进中", "已报价", "已签单", "已付款", "价格流失", "撤单"].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
          </Col>
          <Col xs={24}><Form.Item name="subject" label="邮件主题" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
          <Col xs={24}><Form.Item name="body" label="邮件正文" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={6} /></Form.Item></Col>
        </Row>
        <Space wrap>
          <Button onClick={() => void handlePreview()} loading={loadingPreview}>预览收件人</Button>
          <Button type="primary" htmlType="submit" loading={creating}>创建群发活动</Button>
        </Space>
      </Form>

      {preview ? (
        <Card type="inner" title={`收件人预览：共 ${preview.target_count} 个客户`} style={{ marginTop: 16 }}>
          {preview.warnings.map((warning) => <Alert key={warning} type="warning" showIcon message={warning} style={{ marginBottom: 8 }} />)}
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={preview.recipients_preview}
            columns={[
              { title: "客户", dataIndex: "name" },
              { title: "邮箱", dataIndex: "email", render: (value: string) => value || "—" },
              { title: "国家", dataIndex: "country" },
              { title: "产品", dataIndex: "product" },
              { title: "客户分层", dataIndex: "tier", render: (value: string) => <Tag color="purple">{value}</Tag> }
            ]}
          />
        </Card>
      ) : null}
    </Card>
  );
}
