import { Alert, Button, Card, Col, Descriptions, Form, Input, Row, Space, Tag, Typography, message } from "antd";
import { Mail, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchMyProfile, updateMyPassword, updateMyProfile, type MyProfile } from "../api";

type ProfileFormValues = {
  name: string;
  senderEmail: string;
  senderName: string;
  smtpHost: string;
};

type PasswordFormValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const roleLabel: Record<string, string> = {
  admin: "管理员",
  ops: "运营者",
  sales: "销售"
};

export function MyProfilePage() {
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMyProfile();
      setProfile(result);
      profileForm.setFieldsValue({
        name: result.name,
        senderEmail: result.email_settings.sender_email,
        senderName: result.email_settings.sender_name,
        smtpHost: result.email_settings.smtp_host
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "个人资料加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile(values: ProfileFormValues) {
    setSavingProfile(true);
    setError(null);
    try {
      const result = await updateMyProfile(values);
      setProfile(result);
      message.success("个人资料和邮箱配置已保存");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "个人资料保存失败");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(values: PasswordFormValues) {
    if (values.newPassword !== values.confirmPassword) {
      message.warning("两次输入的新密码不一致");
      return;
    }
    setSavingPassword(true);
    setError(null);
    try {
      await updateMyPassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
      passwordForm.resetFields();
      message.success("密码已修改");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "密码修改失败");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="my-profile-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">个人中心</Typography.Text>
          <Typography.Title level={2}>我的账号与邮箱</Typography.Title>
          <Typography.Paragraph className="muted">
            管理自己的账号名称、登录密码和发件邮箱。管理员/运营可向全部潜在客户发邮件，销售只向自己负责范围内客户发邮件。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Tag color={profile?.email_settings.configured ? "green" : "gold"}>
            {profile?.email_settings.configured ? "邮箱已配置" : "邮箱待配置"}
          </Tag>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="账号信息" loading={loading}>
            {profile ? (
              <Descriptions column={1}>
                <Descriptions.Item label="账号邮箱">{profile.email}</Descriptions.Item>
                <Descriptions.Item label="当前角色">{roleLabel[profile.role] ?? profile.role}</Descriptions.Item>
                <Descriptions.Item label="数据范围">{profile.data_scope || "全部"}</Descriptions.Item>
              </Descriptions>
            ) : null}
            <div className="subtle-note">
              <Typography.Text strong>权限说明</Typography.Text>
              <Typography.Text className="muted">销售账号的客户与再营销范围由配置页的国家销售映射决定；后端仍会拦截越权访问。</Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <Mail size={18} />
                邮箱配置
              </Space>
            }
            loading={loading}
          >
            <Form form={profileForm} layout="vertical" onFinish={(values) => void saveProfile(values)}>
              <Form.Item name="name" label="显示名称" rules={[{ required: true, min: 2 }]}>
                <Input />
              </Form.Item>
              <Form.Item name="senderEmail" label="发件邮箱" rules={[{ required: true }, { type: "email" }]}>
                <Input placeholder="sales@example.com" />
              </Form.Item>
              <Form.Item name="senderName" label="发件人名称" rules={[{ required: true, min: 2 }]}>
                <Input placeholder="Ultrasound Growth Team" />
              </Form.Item>
              <Form.Item name="smtpHost" label="SMTP / 邮件服务主机">
                <Input placeholder="smtp.example.com" />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={savingProfile}>
                保存资料与邮箱
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <ShieldCheck size={18} />
            修改密码
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Form form={passwordForm} layout="vertical" onFinish={(values) => void savePassword(values)}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="confirmPassword" label="再次输入新密码" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
          <Button htmlType="submit" loading={savingPassword}>
            修改密码
          </Button>
        </Form>
      </Card>
    </section>
  );
}
