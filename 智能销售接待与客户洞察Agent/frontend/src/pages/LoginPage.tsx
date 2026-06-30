import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { login, saveSession } from "../api";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();

  async function handleSubmit(values: LoginForm): Promise<void> {
    try {
      const session = await login(values.email, values.password);
      saveSession(session.access_token, session.name, session.role);
      navigate("/admin/dashboard");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    }
  }

  return (
    <main className="login-page">
      <Card className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark">⌁</div>
          <Typography.Title level={3}>Ultrasound Growth</Typography.Title>
        </div>
        <Form<LoginForm> layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          <Form.Item label="账号" name="email" initialValue="admin@ultrasound-growth.local" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="密码" name="password" initialValue="Admin123!" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </main>
  );
}
