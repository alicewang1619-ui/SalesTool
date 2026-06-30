import { Button, Card, Col, Descriptions, Form, Input, Modal, Row, Space, Tag, Typography, Upload, message } from "antd";
import { ArrowLeft, Paperclip, Save, Send, Sparkles } from "lucide-react";
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
  draftContent: string;
  generationPrompt: string;
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
      message.success("再营销草稿已保存");
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
      message.success("已结合提示词和附件重新生成草稿");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (!task) return false;
    setSaving(true);
    try {
      fillForm(await uploadNurtureAttachment(task.id, file));
      message.success("附件素材已上传并进入生成上下文");
    } finally {
      setSaving(false);
    }
    return false;
  }

  async function handleConfirm() {
    if (!task) return;
    const values = await form.validateFields(["draftContent"]);
    Modal.confirm({
      title: "确认发送再营销草稿",
      content: "确认后只进入人工确认发送队列，不会未经确认自动群发。",
      okText: "确认发送",
      cancelText: "取消",
      onOk: async () => {
        fillForm(await confirmNurtureTask(task.id, values.draftContent));
        message.success("草稿已人工确认");
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
            编辑大模型草稿，补充生成提示词和附件素材，确认前保留上下文快照和审计记录。
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

      <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} lg={12}>
            <Card title="建议下一步动作">
              <Form.Item name="recommendedNextAction" rules={[{ required: true, min: 5 }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Typography.Paragraph className="muted">
                该动作展示在客户备注上方，修改后写入 NurtureTask 并保留审计。
              </Typography.Paragraph>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="客户备注">
              <Form.Item name="customerNote">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} lg={10}>
            <Card title="客户摘要与触达理由">
              {task ? (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="客户">{task.customer_name}</Descriptions.Item>
                  <Descriptions.Item label="分层">{task.customer_tier}</Descriptions.Item>
                  <Descriptions.Item label="产品">{task.product}</Descriptions.Item>
                  <Descriptions.Item label="负责人">{task.owner_name}</Descriptions.Item>
                  <Descriptions.Item label="模型">
                    {task.model_provider} / {task.model_version}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={task.approval_status === "confirmed" ? "green" : "purple"}>
                      {task.approval_status === "confirmed" ? "已确认" : "待确认"}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              ) : null}
              <Form.Item name="nurtureReason" label="触达理由" rules={[{ required: true, min: 5 }]}>
                <Input.TextArea rows={5} />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="再营销草稿">
              <Form.Item name="draftContent" rules={[{ required: true, min: 10 }]}>
                <Input.TextArea rows={8} />
              </Form.Item>
              <div className="nurture-prompt-panel">
                <Form.Item name="generationPrompt" label="生成提示词 / 补充指令">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Typography.Paragraph className="muted">
                  提示词、客户摘要、客户背景调查、销售反馈和附件会一起进入大模型生成上下文。
                </Typography.Paragraph>
              </div>
              <div className="nurture-upload-panel">
                <div>
                  <strong>附件素材</strong>
                  <Typography.Paragraph className="muted">
                    上传产品彩页、型号对比表或应用案例，作为生成上下文和待发送附件候选。
                  </Typography.Paragraph>
                </div>
                <Upload beforeUpload={(file) => handleUpload(file as File)} showUploadList={false}>
                  <Button icon={<Paperclip size={16} />}>上传附件</Button>
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
                  <Tag color="gold">暂无附件</Tag>
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
