import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchCustomer, updateCustomerBackground, type Customer } from "../api";

export function CustomerDetailPage() {
  const { customerId = "1" } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm<{ manualSummary: string }>();

  useEffect(() => {
    void fetchCustomer(customerId).then((item) => {
      setCustomer(item);
      form.setFieldValue("manualSummary", item.background.manual_summary ?? item.background.auto_summary);
    });
  }, [customerId, form]);

  async function saveBackground(values: { manualSummary: string }): Promise<void> {
    const updated = await updateCustomerBackground(customerId, values.manualSummary);
    setCustomer(updated);
    message.success("客户背景调查已保存");
  }

  if (!customer) return <Card loading />;

  return (
    <section>
      <Typography.Text className="stage-label">阶段1(MVP) · 客户池</Typography.Text>
      <Typography.Title level={2}>{customer.name}</Typography.Title>
      <Space className="summary-grid">
        <Card title="客户摘要">
          <p>{customer.country} · {customer.customer_type} · {customer.product}</p>
          <TagText label="客户分层" value={customer.tier} />
        </Card>
        <Card title="客户背景调查">
          <p>{customer.background.auto_summary}</p>
          <p className="muted">{customer.background.evidence}</p>
          <p>可信度：{customer.background.confidence}；最近修改：{customer.background.updated_by}</p>
        </Card>
      </Space>
      <Card title="人工调整背景调查">
        <Form form={form} layout="vertical" onFinish={(values) => void saveBackground(values)}>
          <Form.Item name="manualSummary" label="人工修订内容" rules={[{ required: true, min: 10 }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Button type="primary" htmlType="submit">保存人工修改</Button>
        </Form>
      </Card>
    </section>
  );
}

function TagText({ label, value }: { label: string; value: string }) {
  return <p><strong>{label}：</strong>{value}</p>;
}
