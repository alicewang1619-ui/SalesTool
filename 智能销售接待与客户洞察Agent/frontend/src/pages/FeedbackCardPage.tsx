import { Alert, Button, Card, Form, Input, Radio, Result, Space, Spin, Tag, Typography, message } from "antd";
import { Check, RotateCcw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchFeedbackCard, submitFeedbackCard, type FeedbackCard } from "../api";
import { GlobalBanner } from "../shell/GlobalBanner";

type FeedbackForm = {
  feedbackStatus: string;
  customerJudgement: string;
  remark: string;
};

export function FeedbackCardPage() {
  const { token = "" } = useParams();
  const [form] = Form.useForm<FeedbackForm>();
  const [card, setCard] = useState<FeedbackCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; status: "403" | "404" | "500" } | null>(null);

  async function loadCard() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFeedbackCard(token);
      setCard(result);
      setSubmitted(result.submitted);
      form.setFieldsValue({
        feedbackStatus: result.status_options[0],
        customerJudgement: result.judgement_options[0],
        remark: ""
      });
    } catch (err) {
      const errorName = err instanceof Error ? err.name : "HTTP_500";
      if (errorName === "FEEDBACK_LINK_EXPIRED") {
        setError({ title: "反馈链接已过期", message: "请联系管理员重新发送 7 天有效的销售反馈链接。", status: "403" });
      } else if (errorName === "FEEDBACK_LINK_OWNER_MISMATCH") {
        setError({ title: "无权查看此客户", message: "该反馈链接不属于当前负责人，请联系运营重新分配。", status: "403" });
      } else {
        setError({ title: "反馈链接不可用", message: "未找到有效反馈链接，请检查微信或邮件中的完整地址。", status: "404" });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCard();
  }, [token]);

  async function onSubmit(values: FeedbackForm) {
    setSubmitting(true);
    try {
      await submitFeedbackCard(token, values);
      setSubmitted(true);
      message.success("反馈已同步到线索、客户池和报表");
      await loadCard();
    } catch (err) {
      const text = err instanceof Error ? err.message : "提交失败，请重试";
      message.error(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="feedback-app">
      <GlobalBanner />
      <section className="feedback-phone">
        {loading ? (
          <div className="feedback-loading">
            <Spin />
          </div>
        ) : error ? (
          <Result
            status={error.status}
            title={error.title}
            subTitle={error.message}
            extra={<Button icon={<RotateCcw size={16} />} onClick={loadCard}>重试</Button>}
          />
        ) : card ? (
          <>
            <div className="feedback-heading">
              <Typography.Text className="stage-label">销售反馈卡片</Typography.Text>
              <Typography.Title level={1}>{card.lead.customer_name}</Typography.Title>
              <Typography.Paragraph className="muted">
                {card.lead.country} · {card.lead.customer_type} · {card.lead.product}
              </Typography.Paragraph>
              <Space wrap>
                <Tag color="purple">{card.lead.source_category}</Tag>
                <Tag>{card.lead.source_label}</Tag>
                <Tag color={submitted ? "green" : "gold"}>{submitted ? "已反馈" : "待反馈"}</Tag>
              </Space>
            </div>

            <Card className="feedback-card" title="客户摘要">
              <Typography.Paragraph>{card.background_summary}</Typography.Paragraph>
              <div className="feedback-fact">
                <span>负责人</span>
                <strong>{card.owner.name}</strong>
              </div>
              <div className="feedback-fact">
                <span>有效期</span>
                <strong>{new Date(card.expires_at).toLocaleString()}</strong>
              </div>
            </Card>

            <Card className="feedback-card" title="AI 判断理由">
              <Typography.Paragraph>{card.ai_reason}</Typography.Paragraph>
            </Card>

            {submitted ? (
              <Alert
                type="success"
                showIcon
                icon={<Check size={18} />}
                message="已提交反馈"
                description="系统已同步线索状态、反馈历史和报表指标。重复打开此链接不会再次写入反馈。"
              />
            ) : null}

            <Card className="feedback-card" title="快速反馈">
              <Form form={form} layout="vertical" onFinish={onSubmit}>
                <Form.Item name="feedbackStatus" label="反馈状态" rules={[{ required: true, message: "请选择反馈状态" }]}>
                  <Radio.Group optionType="button" buttonStyle="solid" className="feedback-radio">
                    {card.status_options.map((item) => <Radio.Button key={item} value={item}>{item}</Radio.Button>)}
                  </Radio.Group>
                </Form.Item>
                <Form.Item name="customerJudgement" label="客户判断" rules={[{ required: true, message: "请选择客户判断" }]}>
                  <Radio.Group className="feedback-choice">
                    {card.judgement_options.map((item) => <Radio key={item} value={item}>{item}</Radio>)}
                  </Radio.Group>
                </Form.Item>
                <Form.Item name="remark" label="备注">
                  <Input.TextArea rows={4} maxLength={1000} showCount placeholder="可选：客户预算、下一步、风险点" />
                </Form.Item>
                <Button className="full-width" type="primary" htmlType="submit" icon={<Send size={16} />} loading={submitting}>
                  提交反馈
                </Button>
              </Form>
            </Card>
          </>
        ) : null}
      </section>
    </main>
  );
}
