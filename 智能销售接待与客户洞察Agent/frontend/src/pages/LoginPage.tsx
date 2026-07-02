import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { Activity, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, saveSession } from "../api";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("reason") === "expired" ? "会话已过期，请重新登录。" : null
  );

  async function handleSubmit(values: LoginForm): Promise<void> {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const session = await login(values.email, values.password);
      saveSession(session.access_token, session.name, session.role);
      navigate("/admin/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败，请检查账号和密码。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-app">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand-block">
          <div className="brand-mark">UG</div>
          <div>
            <Typography.Text className="stage-label">Ultrasound Growth</Typography.Text>
            <Typography.Title id="login-title" level={1}>智能销售接待与客户洞察 Agent</Typography.Title>
            <Typography.Paragraph>
              统一管理官网、邮箱和展会线索，让运营与销售在同一个后台完成分发、跟进和再营销。
            </Typography.Paragraph>
          </div>
        </div>

        <Card className="login-card" title={<Space><Activity size={18} />登录后台</Space>}>
          {errorMessage ? (
            <Alert className="login-error" type="error" showIcon message={errorMessage} role="alert" aria-live="assertive" />
          ) : (
            <Alert className="login-error" type="info" showIcon message="请输入后台账号和密码，登录后才会显示左侧菜单。" />
          )}

          <Form<LoginForm> layout="vertical" requiredMark={false} onFinish={(values) => void handleSubmit(values)} autoComplete="on">
            <Form.Item
              label="账号邮箱"
              name="email"
              rules={[
                { required: true, message: "请输入账号邮箱。" },
                { type: "email", message: "请输入有效邮箱账号。" }
              ]}
            >
              <Input prefix={<Mail size={16} />} autoComplete="username" placeholder="admin@ultrasound-growth.local" />
            </Form.Item>
            <Form.Item label="登录密码" name="password" rules={[{ required: true, message: "请输入密码。" }]}>
              <Input.Password prefix={<LockKeyhole size={16} />} autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form>

          <div className="login-test-accounts">
            <Typography.Text>测试账号：</Typography.Text>
            <Typography.Text copyable>admin@ultrasound-growth.local / Admin123!</Typography.Text>
            <Typography.Text copyable>maria@ultrasound-growth.local / Sales123!</Typography.Text>
          </div>
        </Card>
      </section>
    </main>
  );
}
