import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Space, Tag, Typography, Upload, message } from "antd";
import { ArrowLeft, Mail, Paperclip, Save, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  confirmNurtureTask,
  fetchNurtureTask,
  regenerateNurtureTask,
  updateNurtureTask,
  uploadNurtureAttachment,
  type NurtureTask
} from "../api";

type NurtureFormValues = {
  recommendedNextAction: string;
  customerNote: string;
  nurtureReason: string;
  emailSubject: string;
  draftContent: string;
  generationPrompt: string;
};

const emailStatusLabels: Record<string, string> = {
  draft: "草稿",
  pending: "待发送",
  sent: "已发送"
};

export function NurtureTaskDetailPage() {
  const { taskId = "" } = useParams();
  const [form] = Form.useForm<NurtureFormValues>();
  const [task, setTask] = useState<NurtureTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function fillForm(nextTask: NurtureTask) {
    setTask(nextTask);
    form.setFieldsValue({
      recommendedNextAction: nextTask.recommended_next_action,
      customerNote: nextTask.customer_note,
      nurtureReason: nextTask.nurture_reason,
      emailSubject: nextTask.email_subject,
      draftContent: nextTask.draft_content,
      generationPrompt: nextTask.generation_prompt
    });
  }

  async function load() {
    if (!taskId) return;
    setLoading(true);
    try {
      fillForm(await fetchNurtureTask(taskId));
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

  async function handleRegenerate() {
    if (!task) return;
    const values = await form.validateFields(["generationPrompt"]);
    setSaving(true);
    try {
      fillForm(await regenerateNurtureTask(task.id, values.generationPrompt ?? ""));
      message.success("已结合提示词和参考附件重新生成草稿");
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
          <span>发件人：{task.sender_email}</span>
          <span>收件人：{task.recipient_email}</span>
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
          <Typography.Text className="stage-label">阶段 2 · 再营销待办</Typography.Text>
          <Typography.Title level={2}>草稿详情确认发送</Typography.Title>
          <Typography.Paragraph className="muted">
            这里是邮件发送前的人工确认页：提示词和附件用于 AI 写邮件，发送前必须看清发件人、收件人、主题和正文。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Link to="/admin/nurture">
            <Button icon={<ArrowLeft size={16} />}>返回列表</Button>
          </Link>
          <Button loading={saving} icon={<Sparkles size={16} />} onClick={handleRegenerate}>
            重新生成
          </Button>
          <Button type="primary" loading={saving} icon={<Send size={16} />} onClick={handleConfirm}>
            人工确认发送
          </Button>
        </Space>
      </div>

      {task?.sender_email ? null : (
        <Alert
          type="warning"
          showIcon
          className="login-error"
          message="发件邮箱未配置"
          description="请先进入“我的”配置个人邮箱；管理员也可以在配置页维护主邮箱策略。"
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} lg={10}>
            <Card
              title={
                <Space>
                  <Mail size={18} />
                  邮件发送信息
                </Space>
              }
              loading={loading}
            >
              {task ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="客户">{task.customer_name}</Descriptions.Item>
                  <Descriptions.Item label="发件人">{task.sender_email || "未配置"}</Descriptions.Item>
                  <Descriptions.Item label="收件人">{task.recipient_email || "客户邮箱缺失"}</Descriptions.Item>
                  <Descriptions.Item label="负责人">{task.owner_name}</Descriptions.Item>
                  <Descriptions.Item label="邮件状态">
                    <Tag color={task.email_status === "sent" ? "green" : "gold"}>{emailStatusLabels[task.email_status] ?? task.email_status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="草稿状态">
                    <Tag color={task.approval_status === "confirmed" ? "green" : "purple"}>
                      {task.approval_status === "confirmed" ? "已确认" : "待确认"}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              ) : null}
              <Form.Item name="emailSubject" label="邮件主题" rules={[{ required: true, min: 3 }]}>
                <Input />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="建议动作与客户备注" loading={loading}>
              <Form.Item name="recommendedNextAction" label="建议下一步动作" rules={[{ required: true, min: 5 }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="customerNote" label="客户备注">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Typography.Paragraph className="muted">
                这些内容用于生成邮件上下文，也会展示在再营销列表和客户池入口。
              </Typography.Paragraph>
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
                  <Descriptions.Item label="模型">
                    {task.model_provider} / {task.model_version}
                  </Descriptions.Item>
                </Descriptions>
              ) : null}
              <Form.Item name="nurtureReason" label="触达理由" rules={[{ required: true, min: 5 }]}>
                <Input.TextArea rows={5} />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="再营销邮件正文" loading={loading}>
              <Form.Item name="draftContent" label="正文" rules={[{ required: true, min: 10 }]}>
                <Input.TextArea rows={8} />
              </Form.Item>
              <div className="nurture-prompt-panel">
                <Form.Item name="generationPrompt" label="生成提示词 / 补充指令">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Typography.Paragraph className="muted">
                  提示词、客户摘要、背景调查、销售反馈和参考附件会一起进入大模型生成上下文。
                </Typography.Paragraph>
              </div>
              <div className="nurture-upload-panel">
                <div>
                  <strong>参考附件</strong>
                  <Typography.Paragraph className="muted">
                    上传产品彩页、型号对比表或应用案例，默认作为 AI 写信素材；是否随邮件发送需后续人工确认。
                  </Typography.Paragraph>
                </div>
                <Upload beforeUpload={(file) => handleUpload(file as File)} showUploadList={false}>
                  <Button icon={<Paperclip size={16} />}>上传参考附件</Button>
                </Upload>
              </div>
              <Space wrap className="tag-cluster">
                {(task?.attachments ?? []).length ? (
                  task?.attachments.map((item) => (
                    <Tag key={`${item.filename}-${item.uploaded_at}`} color="blue">
                      {item.filename} · {Math.max(1, Math.ceil(item.size / 1024))} KB
                    </Tag>
                  ))
                ) : (
                  <Tag color="gold">暂无参考附件</Tag>
                )}
              </Space>
              <Space wrap style={{ marginTop: 16 }}>
                <Button htmlType="submit" loading={saving} icon={<Save size={16} />}>
                  保存修正
                </Button>
                <Button loading={saving} icon={<Sparkles size={16} />} onClick={handleRegenerate}>
                  重新生成
                </Button>
                <Button type="primary" loading={saving} icon={<Send size={16} />} onClick={handleConfirm}>
                  人工确认发送
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>

      <Card title="大模型生成上下文快照">
        <Input.TextArea value={task?.prompt_context_snapshot.rendered_prompt ?? ""} rows={8} readOnly />
      </Card>
    </>
  );
}
