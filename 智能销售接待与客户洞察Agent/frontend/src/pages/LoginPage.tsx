import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { Activity, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, saveSession } from "../api";
import { GlobalBanner } from "../shell/GlobalBanner";

type LoginForm = {
  email: string;
  password: string;
};

const loginNavItems = ["工作台", "线索池", "客户池", "报表", "再营销", "配置"];

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("reason") === "expired" ? "会话已过期，请重新登录。" : null
  );

  async function handleSubmit(values: LoginForm): Promise<void> {
    setErrorMessage(null);
    try {
      const session = await login(values.email, values.password);
      saveSession(session.access_token, session.name, session.role);
      navigate("/admin/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败，请重试。");
    }
  }

  return (
    <div className="login-app">
      <aside className="login-sidebar" aria-label="后台主导航预览">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={26} aria-hidden="true" />
          </div>
          <Typography.Title level={4}>Ultrasound Growth</Typography.Title>
        </div>
        <nav className="login-nav">
          {loginNavItems.map((item) => (
            <span key={item} className={item === "工作台" ? "active" : ""}>
              <ChevronRight size={18} aria-hidden="true" />
              {item}
            </span>
          ))}
        </nav>
      </aside>
      <main className="login-main">
        <GlobalBanner />
        <section className="login-hero-grid">
          <section className="login-copy" aria-labelledby="login-title">
            <div className="stage-label">Ultrasound Sales Growth</div>
            <Typography.Title id="login-title" level={1}>
              智能销售接待与客户洞察 Agent
            </Typography.Title>
            <Typography.Paragraph className="muted">
              把官网、邮箱和展会名片里的询盘收进一个可反馈、可报表、可再营销的闭环。
            </Typography.Paragraph>
          </section>
          <Card className="login-card" title="登录后台">
            {errorMessage ? (
              <Alert
                className="login-error"
                type="error"
                showIcon
                message={errorMessage}
                role="alert"
                aria-live="assertive"
              />
            ) : (
              <div className="login-error-placeholder" role="status" aria-live="polite">
                请输入后台账号和密码。
              </div>
            )}
            <Form<LoginForm>
              layout="vertical"
              requiredMark={false}
              onFinish={(values) => void handleSubmit(values)}
              autoComplete="on"
            >
              <Form.Item
                label="账号"
                name="email"
                rules={[
                  { required: true, message: "请输入账号。" },
                  { type: "email", message: "请输入有效邮箱账号。" }
                ]}
              >
                <Input autoComplete="username" placeholder="name@company.com" aria-describedby="login-title" />
              </Form.Item>
              <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码。" }]}>
                <Input.Password autoComplete="current-password" placeholder="请输入密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                登录
              </Button>
            </Form>
          </Card>
        </section>
      </main>
    </div>
  );
}
