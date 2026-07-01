import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Tag, Typography, Upload, message } from "antd";
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
  writerRoleKey: string;
};

const emailStatusLabels: Record<string, string> = {
  draft: "草稿",
  pending: "待发送",
  sent: "已发送"
};

const fallbackEmailWriterRoles: EmailWriterRole[] = [
  { key: "doraemon", name: "Doraemon", display_name: "哆啦A梦", style: "温暖、可靠、什么都能帮你", skills: ["万能助手", "日常回复"], best_for: "万能助手、日常回复、客户维护", status: "enabled" },
  { key: "mario", name: "Mario", display_name: "超级马里奥", style: "积极、行动派、有冲劲", skills: ["销售跟进", "推动决策"], best_for: "销售跟进、催单、推动决策", status: "enabled" },
  { key: "pikachu", name: "Pikachu", display_name: "皮卡丘", style: "活泼、可爱、有亲和力", skills: ["社媒互动", "轻松话题"], best_for: "社媒互动、年轻客户、轻松话题", status: "enabled" },
  { key: "totoro", name: "Totoro", display_name: "龙猫", style: "温柔、治愈、让人安心", skills: ["客户关怀", "暖心邮件"], best_for: "客户关怀、节日问候、暖心邮件", status: "enabled" },
  { key: "baymax", name: "Baymax", display_name: "大白", style: "稳重、专业、可靠", skills: ["正式邮件", "技术沟通"], best_for: "正式邮件、医疗客户、技术沟通", status: "enabled" },
  { key: "nemo", name: "Nemo", display_name: "海底总动员", style: "好奇、探索、愿意沟通", skills: ["陌生开发", "破冰邮件"], best_for: "陌生开发、初次接触、破冰邮件", status: "enabled" }
];

export function NurtureTaskDetailPage() {
  const { taskId = "" } = useParams();
  const [form] = Form.useForm<NurtureFormValues>();
  const [task, setTask] = useState<NurtureTask | null>(null);
  const [writerRoles, setWriterRoles] = useState<EmailWriterRole[]>(fallbackEmailWriterRoles);
  const [defaultWriterRole, setDefaultWriterRole] = useState("baymax");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const writerRoleKey = Form.useWatch("writerRoleKey", form);
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
      writerRoleKey: nextTask.writer_role_key || nextDefaultWriterRole
    });
  }

  async function load() {
    if (!taskId) return;
    setLoading(true);
    try {
      const [nextTask, writers] = await Promise.all([
        fetchNurtureTask(taskId),
        fetchEmailWriterRoles().catch(() => ({ default_email_writer: "baymax", items: [] }))
      ]);
      const nextWriterRoles = writers.items.length ? [...writers.items] : [...fallbackEmailWriterRoles];
      const writerRoleKeys = new Set(nextWriterRoles.map((writer) => writer.key));
      const taskWriterFallback = fallbackEmailWriterRoles.find((writer) => writer.key === nextTask.writer_role_key);
      if (taskWriterFallback && !writerRoleKeys.has(taskWriterFallback.key)) nextWriterRoles.push(taskWriterFallback);
      const nextDefaultWriterRole = writers.default_email_writer || nextWriterRoles[0]?.key || "baymax";
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

  async function handleRegenerate() {
    if (!task) return;
    const values = await form.validateFields(["generationPrompt", "writerRoleKey"]);
    setSaving(true);
    try {
      fillForm(await regenerateNurtureTask(task.id, values.generationPrompt ?? "", values.writerRoleKey));
      message.success("已结合提示词、写手角色和参考附件重新生成草稿");
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
          <Typography.Text className="stage-label">阶段 2 · 再营销待办</Typography.Text>
          <Typography.Title level={2}>草稿详情确认发送</Typography.Title>
          <Typography.Paragraph className="muted">这里是邮件发送前的人工确认页：提示词和附件用于 AI 写邮件，发送前必须看清发件人、收件人、主题和正文。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Link to="/admin/nurture"><Button icon={<ArrowLeft size={16} />}>返回列表</Button></Link>
          <Button loading={saving} icon={<Sparkles size={16} />} onClick={handleRegenerate}>重新生成</Button>
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
                  <Descriptions.Item label="写手">{task.writer_role_name} · {task.writer_role_style}</Descriptions.Item>
                </Descriptions>
              ) : null}
              <Form.Item name="nurtureReason" label="触达理由" rules={[{ required: true, min: 5 }]}><Input.TextArea rows={5} /></Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="再营销邮件正文" loading={loading}>
              <Form.Item name="writerRoleKey" label="邮件写手角色" rules={[{ required: true }]}>
                <Select options={writerRoles.map((writer) => ({ value: writer.key, label: `${writer.name} / ${writer.display_name} · ${writer.style}` }))} placeholder="选择写邮件的人物风格" />
              </Form.Item>
              {selectedWriter ? <Alert showIcon type="info" className="login-error" message={`${selectedWriter.display_name}：${selectedWriter.style}`} description={`技能：${selectedWriter.skills.join("、")}；适用：${selectedWriter.best_for}`} /> : null}
              <Form.Item name="draftContent" label="正文" rules={[{ required: true, min: 10 }]}><Input.TextArea rows={8} /></Form.Item>
              <div className="nurture-prompt-panel">
                <Form.Item name="generationPrompt" label="生成提示词 / 补充指令"><Input.TextArea rows={4} /></Form.Item>
                <Typography.Paragraph className="muted">提示词、客户摘要、背景调查、销售反馈和参考附件会一起进入大模型生成上下文。</Typography.Paragraph>
              </div>
              <div className="nurture-upload-panel">
                <div><strong>参考附件</strong><Typography.Paragraph className="muted">上传产品彩页、型号对比表或应用案例，默认作为 AI 写信素材；是否随邮件发送需要后续人工确认。</Typography.Paragraph></div>
                <Upload beforeUpload={(file) => handleUpload(file as File)} showUploadList={false}><Button icon={<Paperclip size={16} />}>上传参考附件</Button></Upload>
              </div>
              <Space wrap className="tag-cluster">
                {(task?.attachments ?? []).length ? task?.attachments.map((item) => <Tag key={`${item.filename}-${item.uploaded_at}`} color="blue">{item.filename} · {Math.max(1, Math.ceil(item.size / 1024))} KB</Tag>) : <Tag color="gold">暂无参考附件</Tag>}
              </Space>
              <Space wrap style={{ marginTop: 16 }}>
                <Button htmlType="submit" loading={saving} icon={<Save size={16} />}>保存修正</Button>
                <Button loading={saving} icon={<Sparkles size={16} />} onClick={handleRegenerate}>重新生成</Button>
                <Button type="primary" loading={saving} icon={<Send size={16} />} onClick={handleConfirm}>人工确认发送</Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </>
  );
}
