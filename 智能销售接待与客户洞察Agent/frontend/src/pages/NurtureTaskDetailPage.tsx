import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Tag, Tooltip, Typography, Upload, message } from "antd";
import { ArrowLeft, Mail, Paperclip, Save, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  confirmNurtureTask,
  fetchEmailWriterRoles,
  fetchNurtureTask,
  regenerateNurtureTask,
  updateNurtureTask,
  uploadNurtureAttachment,
  type EmailWriterRole,
  type NurtureTask
} from "../api";

type NurtureFormValues = {
  recommendedNextAction: string;
  customerNote: string;
  nurtureReason: string;
  emailSubject: string;
  draftContent: string;
  generationPrompt: string;
  emailPurpose: string;
  writerRoleKey: string;
};

const emailStatusLabels: Record<string, string> = {
  draft: "草稿",
  pending: "待发送",
  sent: "已发送"
};

const fallbackEmailWriterRoles: EmailWriterRole[] = [
  { key: "reply_mirror", name: "ReplyMirror", display_name: "ReplyMirror", style: "Reflective, precise, customer-led", skills: ["Customer email reply", "Intent reflection", "Follow-up CTA"], best_for: "Replying to existing inquiries", capabilities: "Mirror customer intent and turn scattered inquiry context into a clear response.", role_goal: "Write a natural reply that clarifies the next step.", background: "Best for customer replies after an inquiry or follow-up.", tags: ["reply", "mirror-customer-intent"], status: "enabled" },
  { key: "mario", name: "Mario", display_name: "Mario", style: "Energetic, direct, momentum-building", skills: ["Sales follow-up", "Decision push"], best_for: "Active follow-up and decision momentum", capabilities: "Move a conversation toward a clear next step.", role_goal: "Help the customer make a concrete decision.", background: "Best for stalled deals after quote or product comparison.", tags: ["action", "sales-follow-up"], status: "enabled" },
  { key: "baymax", name: "Baymax", display_name: "Baymax", style: "Steady, professional, reliable", skills: ["Formal email", "Medical customer communication", "Technical explanation"], best_for: "Formal medical customer communication", capabilities: "Turn technical points into credible commercial language.", role_goal: "Provide a reliable reply with compliance boundaries.", background: "Best for hospitals and technical discussions.", tags: ["formal", "medical", "technical"], status: "enabled" }
];

const emailPurposeOptions = [
  { value: "Customer reply follow-up", label: "Customer reply follow-up" },
  { value: "Post-quote follow-up", label: "Post-quote follow-up" },
  { value: "Product comparison", label: "Product comparison" },
  { value: "Meeting invitation", label: "Meeting invitation" },
  { value: "Reactivation", label: "Reactivation" }
];

function writerTooltipTitle(writer: EmailWriterRole) {
  return `Goal: ${writer.role_goal || writer.best_for || "Not configured"}; Capabilities: ${writer.capabilities || writer.style || "Not configured"}; Skills: ${writer.skills.join(", ") || "Not configured"}; Background: ${writer.background || "Not configured"}; Tags: ${(writer.tags ?? []).join(", ") || "None"}`;
}

function writerNameLabel(writer: EmailWriterRole) {
  return (
    <Tooltip placement="right" title={writerTooltipTitle(writer)}>
      <span>{writer.name}</span>
    </Tooltip>
  );
}

export function NurtureTaskDetailPage() {
  const { taskId = "" } = useParams();
  const [form] = Form.useForm<NurtureFormValues>();
  const [task, setTask] = useState<NurtureTask | null>(null);
  const [writerRoles, setWriterRoles] = useState<EmailWriterRole[]>(fallbackEmailWriterRoles);
  const [defaultWriterRole, setDefaultWriterRole] = useState("reply_mirror");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const writerRoleKey = Form.useWatch("writerRoleKey", form);
  const emailPurpose = Form.useWatch("emailPurpose", form);
  const selectedWriter = useMemo(
    () => writerRoles.find((writer) => writer.key === writerRoleKey) ?? writerRoles.find((writer) => writer.key === task?.writer_role_key),
    [task?.writer_role_key, writerRoleKey, writerRoles]
  );

  function fillForm(nextTask: NurtureTask, nextDefaultWriterRole = defaultWriterRole) {
    setTask(nextTask);
    form.setFieldsValue({
      recommendedNextAction: nextTask.recommended_next_action,
      customerNote: nextTask.customer_note,
      nurtureReason: nextTask.nurture_reason,
      emailSubject: nextTask.email_subject,
      draftContent: nextTask.draft_content,
      generationPrompt: nextTask.generation_prompt,
      emailPurpose: nextTask.email_purpose || "Customer reply follow-up",
      writerRoleKey: nextTask.writer_role_key || nextDefaultWriterRole
    });
  }

  async function load() {
    if (!taskId) return;
    setLoading(true);
    try {
      const [nextTask, writers] = await Promise.all([
        fetchNurtureTask(taskId),
        fetchEmailWriterRoles().catch(() => ({ default_email_writer: "reply_mirror", items: [] }))
      ]);
      const nextWriterRoles = writers.items.length ? [...writers.items] : [...fallbackEmailWriterRoles];
      const writerRoleKeys = new Set(nextWriterRoles.map((writer) => writer.key));
      const taskWriterFallback = fallbackEmailWriterRoles.find((writer) => writer.key === nextTask.writer_role_key);
      if (taskWriterFallback && !writerRoleKeys.has(taskWriterFallback.key)) nextWriterRoles.push(taskWriterFallback);
      const nextDefaultWriterRole = writers.default_email_writer || nextWriterRoles[0]?.key || "reply_mirror";
      setWriterRoles(nextWriterRoles);
      setDefaultWriterRole(nextDefaultWriterRole);
      fillForm(nextTask, nextDefaultWriterRole);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [taskId]);

  async function handleSave(values: NurtureFormValues) {
    if (!task) return;
    setSaving(true);
    try {
      fillForm(await updateNurtureTask(task.id, values));
      message.success("再营销邮件草稿已保存");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate(overrides: Partial<Pick<NurtureFormValues, "writerRoleKey" | "emailPurpose">> = {}) {
    if (!task) return;
    const values = await form.validateFields(["generationPrompt", "writerRoleKey", "emailPurpose"]);
    const nextValues = { ...values, ...overrides };
    setSaving(true);
    try {
      fillForm(await regenerateNurtureTask(task.id, {
        generationPrompt: nextValues.generationPrompt ?? "",
        writerRoleKey: nextValues.writerRoleKey,
        emailPurpose: nextValues.emailPurpose
      }));
      message.success("已结合邮件目的、写手角色和参考附件重新生成草稿");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (!task) return false;
    setSaving(true);
    try {
      fillForm(await uploadNurtureAttachment(task.id, file));
      message.success("参考附件已上传，并进入 AI 写信上下文");
    } finally {
      setSaving(false);
    }
    return false;
  }

  async function handleConfirm() {
    if (!task) return;
    const values = await form.validateFields(["emailSubject", "draftContent"]);
    Modal.confirm({
      title: "确认发送再营销邮件",
      content: (
        <Space direction="vertical" size={4}>
          <span>发件人：{task.sender_email || "未配置"}</span>
          <span>收件人：{task.recipient_email || "客户邮箱缺失"}</span>
          <span>主题：{values.emailSubject}</span>
          <span>确认后进入人工确认发送流程，并写入发送审计。</span>
        </Space>
      ),
      okText: "确认发送",
      cancelText: "取消",
      onOk: async () => {
        fillForm(await confirmNurtureTask(task.id, values.draftContent, values.emailSubject));
        message.success("邮件已人工确认发送");
      }
    });
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>草稿详情确认发送</Typography.Title>
          <Typography.Paragraph className="muted">这里是邮件发送前的人工确认页：提示词和附件用于 AI 写邮件，发送前必须看清发件人、收件人、主题和正文。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Link to="/admin/nurture"><Button icon={<ArrowLeft size={16} />}>返回列表</Button></Link>
          <Button loading={saving} icon={<Sparkles size={16} />} onClick={() => void handleRegenerate()}>重新生成</Button>
          <Button type="primary" loading={saving} icon={<Send size={16} />} onClick={handleConfirm}>人工确认发送</Button>
        </Space>
      </div>

      {task?.sender_email ? null : <Alert type="warning" showIcon className="login-error" message="发件邮箱未配置" description="请先进入配置中心的邮件接口，或在我的页面配置个人邮箱。" />}

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} lg={10}>
            <Card title={<Space><Mail size={18} />邮件发送信息</Space>} loading={loading}>
              {task ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="客户">{task.customer_name}</Descriptions.Item>
                  <Descriptions.Item label="发件人">{task.sender_email || "未配置"}</Descriptions.Item>
                  <Descriptions.Item label="收件人">{task.recipient_email || "客户邮箱缺失"}</Descriptions.Item>
                  <Descriptions.Item label="负责人">{task.owner_name}</Descriptions.Item>
                  <Descriptions.Item label="邮件状态"><Tag color={task.email_status === "sent" ? "green" : "gold"}>{emailStatusLabels[task.email_status] ?? task.email_status}</Tag></Descriptions.Item>
                  <Descriptions.Item label="草稿状态"><Tag color={task.approval_status === "confirmed" ? "green" : "purple"}>{task.approval_status === "confirmed" ? "已确认" : "待确认"}</Tag></Descriptions.Item>
                </Descriptions>
              ) : null}
              <Form.Item name="emailSubject" label="邮件主题" rules={[{ required: true, min: 3 }]}><Input /></Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="建议动作与客户备注" loading={loading}>
              <Form.Item name="recommendedNextAction" label="建议下一步动作" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="customerNote" label="客户备注"><Input.TextArea rows={3} /></Form.Item>
              <Typography.Paragraph className="muted">这些内容用于生成邮件上下文，也会展示在再营销列表和客户详情。</Typography.Paragraph>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} lg={10}>
            <Card title="客户摘要与触达理由" loading={loading}>
              {task ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="客户分层">{task.customer_tier}</Descriptions.Item>
                  <Descriptions.Item label="产品">{task.product}</Descriptions.Item>
                  <Descriptions.Item label="模型">{task.model_provider} / {task.model_version}</Descriptions.Item>
                  <Descriptions.Item label="邮件目的"><Tag color="purple">Purpose: {task.email_purpose}</Tag></Descriptions.Item>
                  <Descriptions.Item label="写手">
                    <Tooltip title={selectedWriter ? writerTooltipTitle(selectedWriter) : task.writer_role_style}>
                      <span>{task.writer_role_name}</span>
                    </Tooltip>
                  </Descriptions.Item>
                </Descriptions>
              ) : null}
              <Form.Item name="nurtureReason" label="触达理由" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={5} /></Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title={<Space>再营销邮件正文<Tag color="purple">Purpose: {emailPurpose || task?.email_purpose || "Customer reply follow-up"}</Tag></Space>} loading={loading}>
              <Form.Item name="emailPurpose" label="邮件目的" rules={[{ required: true, min: 2 }]}>
                <Select
                  showSearch
                  options={emailPurposeOptions}
                  placeholder="选择本次发邮件目的"
                  onChange={(value) => void handleRegenerate({ emailPurpose: value })}
                />
              </Form.Item>
              <Form.Item name="writerRoleKey" label="邮件写手角色" rules={[{ required: true }]}>
                <Select
                  options={writerRoles.map((writer) => ({ value: writer.key, label: writerNameLabel(writer) }))}
                  placeholder="选择写邮件角色"
                  onChange={(value) => void handleRegenerate({ writerRoleKey: value })}
                />
              </Form.Item>
              {selectedWriter ? (
                <Tooltip title={writerTooltipTitle(selectedWriter)}>
                  <Button style={{ marginBottom: 12 }}>{selectedWriter.name}</Button>
                </Tooltip>
              ) : null}
              <Form.Item name="draftContent" label="正文" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={8} /></Form.Item>
              <div className="nurture-prompt-panel">
                <Form.Item name="generationPrompt" label="生成提示词 / 补充指令"><Input.TextArea rows={4} /></Form.Item>
                <Typography.Paragraph className="muted">提示词、客户摘要、背景调查、销售反馈和参考附件会一起进入大模型生成上下文。</Typography.Paragraph>
              </div>
              <div className="nurture-upload-panel">
                <div><strong>参考附件</strong><Typography.Paragraph className="muted">上传产品彩页、型号对比表或应用案例，默认作为 AI 写信素材；是否随邮件发送需要后续人工确认。</Typography.Paragraph></div>
                <Upload accept=".pdf,.doc,.docx,.xls,.xlsx" beforeUpload={(file) => handleUpload(file as File)} showUploadList={false}><Button icon={<Paperclip size={16} />}>上传 PDF / Word / Excel</Button></Upload>
              </div>
              <Space wrap className="tag-cluster">
                {(task?.attachments ?? []).length ? task?.attachments.map((item) => <Tag key={`${item.filename}-${item.uploaded_at}`} color="blue">{item.filename} · {Math.max(1, Math.ceil(item.size / 1024))} KB</Tag>) : <Tag color="gold">暂无参考附件</Tag>}
              </Space>
              <Space wrap style={{ marginTop: 16 }}>
                <Button htmlType="submit" loading={saving} icon={<Save size={16} />}>保存修正</Button>
                <Button loading={saving} icon={<Sparkles size={16} />} onClick={() => void handleRegenerate()}>重新生成</Button>
                <Button type="primary" loading={saving} icon={<Send size={16} />} onClick={handleConfirm}>人工确认发送</Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </>
  );
}
