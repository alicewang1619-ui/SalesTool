import { Alert, Button, Card, Col, Empty, Form, Input, Row, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, Upload, message } from "antd";
import { CheckCircle2, FileText, Filter, Mail, Paperclip } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createBulkEmailCampaign,
  fetchEmailWriterRoles,
  fetchNurtureTasks,
  previewBulkEmailCampaign,
  type BulkEmailFilters,
  type BulkEmailPreview,
  type EmailWriterRole,
  type NurtureAttachment,
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
  purpose?: string;
  subject?: string;
  body?: string;
  generationPrompt?: string;
  writerRoleKey?: string;
};

const defaultBulkPurpose = "开发信";
const promotionBulkPurpose = "活动推广";
const customBulkPurpose = "自定义类型";

const bulkPurposeTemplates: Record<string, { subject: string; body: string; generationPrompt: string }> = {
  [defaultBulkPurpose]: {
    subject: "Portable Ultrasound cooperation opportunity",
    body: "Hi, we noticed your medical imaging business and would like to introduce CHISON portable ultrasound options for clinics and distributors.",
    generationPrompt: "生成一封专业开发信，确认应用场景、采购窗口和下一步沟通，不承诺价格、独家代理或注册证。"
  },
  [promotionBulkPurpose]: {
    subject: "Ultrasound campaign update for your market",
    body: "Hi, we prepared a short campaign update and product material that may help your team evaluate upcoming ultrasound opportunities.",
    generationPrompt: "生成一封活动推广邮件，突出资料价值，邀请客户查看材料或预约沟通，避免未经确认的折扣承诺。"
  },
  [customBulkPurpose]: {
    subject: "Ultrasound follow-up",
    body: "Hi, we prepared a short update and would like to confirm your current ultrasound needs.",
    generationPrompt: "按运营自定义目的、筛选客户、邮件写手风格和参考附件生成邮件，避免未经支持的承诺。"
  }
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
  const template = bulkPurposeTemplates[defaultBulkPurpose];
  return {
    country: searchParams.get("country") || undefined,
    product: searchParams.get("product") || undefined,
    tier: searchParams.get("tier") || undefined,
    purpose: defaultBulkPurpose,
    subject: template.subject,
    body: template.body,
    generationPrompt: template.generationPrompt
  };
}

function writerTooltipTitle(writer: EmailWriterRole) {
  return `Goal: ${writer.role_goal || writer.best_for || "Not configured"}; Capabilities: ${writer.capabilities || writer.style || "Not configured"}; Skills: ${writer.skills?.join(", ") || "Not configured"}; Background: ${writer.background || "Not configured"}; Tags: ${(writer.tags ?? []).join(", ") || "None"}`;
}

function writerNameLabel(writer: EmailWriterRole) {
  return (
    <Tooltip placement="right" title={writerTooltipTitle(writer)}>
      <span>{writer.name}</span>
    </Tooltip>
  );
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
  const [writerRoles, setWriterRoles] = useState<EmailWriterRole[]>([]);
  const [referenceAttachments, setReferenceAttachments] = useState<NurtureAttachment[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  useEffect(() => {
    fetchEmailWriterRoles()
      .then((result) => {
        setWriterRoles(result.items);
        const defaultWriter = result.items.find((role) => role.key === result.default_email_writer) ?? result.items[0];
        if (!form.getFieldValue("writerRoleKey") && defaultWriter) {
          form.setFieldValue("writerRoleKey", defaultWriter.key);
        }
      })
      .catch(() => setWriterRoles([]));
  }, [form]);

  function applyPurposeTemplate(purpose: string) {
    const template = bulkPurposeTemplates[purpose] ?? bulkPurposeTemplates[customBulkPurpose];
    form.setFieldsValue({
      purpose,
      subject: template.subject,
      body: template.body,
      generationPrompt: template.generationPrompt
    });
  }

  function beforeReferenceUpload(file: File) {
    const suffix = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "doc", "docx", "xls", "xlsx"].includes(suffix)) {
      message.error("参考附件仅支持 PDF / Word / Excel");
      return Upload.LIST_IGNORE;
    }
    setReferenceAttachments((current) => [
      ...current,
      {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
        uploaded_by: "当前操作人",
        uploaded_at: new Date().toISOString()
      }
    ]);
    message.success(`${file.name} 已加入参考附件`);
    return Upload.LIST_IGNORE;
  }

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
        purpose: values.purpose ?? defaultBulkPurpose,
        subject: values.subject ?? "",
        body: values.body ?? "",
        generationPrompt: values.generationPrompt ?? "",
        writerRoleKey: values.writerRoleKey,
        referenceAttachments
      });
      message.success(`群发邮件草稿已创建，目标客户 ${campaign.target_count} 个，等待邮箱配置和人工确认后再发送`);
      await handlePreview();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card
      title="群发邮件 / 邮件活动"
      extra={
        <Space>
          <Tooltip title="群发邮件仅管理员和运营可用；第一版只创建草稿、模板和预览，真正发送依赖邮箱接口配置成功后再执行。">
            <Button icon={<Mail size={16} />}>群发规则说明</Button>
          </Tooltip>
          <Button icon={<Mail size={16} />} loading={loadingPreview} onClick={() => void handlePreview()}>预览收件人</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={(values) => void handleCreate(values)}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="purpose" label="群发目的" rules={[{ required: true }]}>
              <Select
                options={[defaultBulkPurpose, promotionBulkPurpose, customBulkPurpose].map((item) => ({ value: item, label: item }))}
                onChange={applyPurposeTemplate}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="writerRoleKey" label="邮件写手">
              <Select
                allowClear
                placeholder="选择邮件写手"
                options={writerRoles.map((role) => ({ value: role.key, label: writerNameLabel(role) }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="参考附件">
              <Upload beforeUpload={beforeReferenceUpload} showUploadList={false} accept=".pdf,.doc,.docx,.xls,.xlsx">
                <Button icon={<Paperclip size={16} />}>上传 PDF / Word / Excel</Button>
              </Upload>
            </Form.Item>
          </Col>
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
          <Col xs={24}><Form.Item name="generationPrompt" label="生成 Prompt"><Input.TextArea rows={4} /></Form.Item></Col>
        </Row>
        {referenceAttachments.length ? (
          <Space wrap style={{ marginBottom: 16 }}>
            {referenceAttachments.map((attachment) => (
              <Tag key={`${attachment.filename}-${attachment.uploaded_at}`} color="blue">{attachment.filename}</Tag>
            ))}
          </Space>
        ) : null}
        <Space wrap>
          <Button onClick={() => void handlePreview()} loading={loadingPreview}>预览收件人</Button>
          <Button type="primary" htmlType="submit" loading={creating}>创建群发草稿</Button>
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
