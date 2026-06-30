import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload
} from "antd";
import { FileUp, History, ImageUp, Save, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createSalesUser,
  fetchSettingsOverview,
  updateSettingsBanner,
  updateSettingsPermissions,
  type SalesUser,
  type SettingsOverview
} from "../api";

const roleOptions = [
  { label: "管理员", value: "admin" },
  { label: "营销/运营", value: "ops" },
  { label: "销售", value: "sales" }
];

const permissionOptions = [
  "settings.manage",
  "settings.banner.update",
  "users.manage",
  "reports.read",
  "reports.export",
  "leads.read",
  "customers.read",
  "leads.assigned.read",
  "feedback.submit"
];

type TraceableError = Error & { traceId?: string };

function asTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) {
    return error as TraceableError;
  }
  return new Error("设置管理加载失败");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Banner 图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const [form] = Form.useForm();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingPermission, setSavingPermission] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("ops");
  const [permissionValues, setPermissionValues] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<TraceableError | null>(null);
  const [bannerDraft, setBannerDraft] = useState({
    title: "",
    body: "",
    imageUrl: "",
    linkUrl: "/admin/settings"
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSettingsOverview();
      setOverview(result);
      setBannerDraft({
        title: result.banner.title,
        body: result.banner.body,
        imageUrl: result.banner.image_url,
        linkUrl: result.banner.link_url ?? "/admin/settings"
      });
      const currentRole = result.permissions.find((row) => row.role === selectedRole) ?? result.permissions[0];
      if (currentRole) {
        setSelectedRole(currentRole.role);
        setPermissionValues(currentRole.permissions);
      }
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentPermission = useMemo(
    () => overview?.permissions.find((row) => row.role === selectedRole),
    [overview, selectedRole]
  );

  useEffect(() => {
    if (currentPermission) {
      setPermissionValues(currentPermission.permissions);
    }
  }, [currentPermission]);

  async function publishBanner() {
    setSavingBanner(true);
    setError(null);
    try {
      await updateSettingsBanner({
        title: bannerDraft.title,
        body: bannerDraft.body,
        imageUrl: bannerDraft.imageUrl,
        linkUrl: bannerDraft.linkUrl,
        active: true
      });
      setNotice("Banner 已发布到全部后台页面");
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingBanner(false);
    }
  }

  async function savePermissions() {
    setSavingPermission(true);
    setError(null);
    try {
      await updateSettingsPermissions({ role: selectedRole, permissions: permissionValues });
      setNotice("权限矩阵已保存并写入审计日志");
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingPermission(false);
    }
  }

  async function submitSalesUser(values: {
    name: string;
    email: string;
    password: string;
    role: string;
    dataScope: string;
  }) {
    setCreatingUser(true);
    setError(null);
    try {
      await createSalesUser({ ...values, enabled: true });
      setNotice("销售账号已创建并写入审计日志");
      setCreateOpen(false);
      form.resetFields();
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 系统配置</Typography.Text>
          <Typography.Title level={2}>设置管理</Typography.Title>
          <Typography.Paragraph className="muted">
            集中维护销售账号、角色权限、全局 Banner、国家销售映射、产品知识库、来源字典、渠道和提醒规则。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<FileUp size={16} />}>导入账号</Button>
          <Button icon={<History size={16} />}>审计日志</Button>
          <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setCreateOpen(true)}>
            新增销售
          </Button>
        </Space>
      </div>

      {notice ? <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} /> : null}
      {error ? <Alert type="error" showIcon message="设置操作失败" description={error.message} /> : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="销售账号" value={overview?.summary.sales_users ?? 0} prefix={<Users size={18} />} />
            <div className="metric-chip">账号与权限可审计</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="启用来源" value={overview?.summary.sources ?? 0} />
            <div className="metric-chip green">来源字典驱动筛选</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="国家映射" value={overview?.summary.country_mappings ?? 0} />
            <div className="metric-chip amber">缺口进入待分配</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="全局 Banner" value={overview?.summary.active_banners ?? 0} prefix={<ImageUp size={18} />} />
            <div className="metric-chip">所有后台页统一读取</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} xl={14}>
          <Card title="顶部 Banner 管理" loading={loading}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={11}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Upload
                    accept="image/png,image/jpeg,image/webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void fileToDataUrl(file as File).then((url) => {
                        setBannerDraft((current) => ({ ...current, imageUrl: url }));
                        setNotice("Banner 图片已载入预览，发布后同步到全部页面");
                      });
                      return false;
                    }}
                  >
                    <Button icon={<ImageUp size={16} />}>上传 Banner 图片</Button>
                  </Upload>
                  <Input
                    aria-label="Banner 标题"
                    value={bannerDraft.title}
                    onChange={(event) => setBannerDraft((current) => ({ ...current, title: event.target.value }))}
                  />
                  <Input.TextArea
                    aria-label="Banner 说明"
                    value={bannerDraft.body}
                    autoSize={{ minRows: 3, maxRows: 5 }}
                    onChange={(event) => setBannerDraft((current) => ({ ...current, body: event.target.value }))}
                  />
                  <Input
                    aria-label="Banner 跳转链接"
                    value={bannerDraft.linkUrl}
                    onChange={(event) => setBannerDraft((current) => ({ ...current, linkUrl: event.target.value }))}
                  />
                  <Button type="primary" icon={<Save size={16} />} loading={savingBanner} onClick={() => void publishBanner()}>
                    发布到全部页面
                  </Button>
                </Space>
              </Col>
              <Col xs={24} md={13}>
                <div className="banner-preview" style={{ backgroundImage: `linear-gradient(105deg, rgba(17,24,39,.76), rgba(91,75,219,.72)), url(${bannerDraft.imageUrl})` }}>
                  <strong>{bannerDraft.title}</strong>
                  <span>{bannerDraft.body}</span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="配置风险" loading={loading}>
            <List
              dataSource={overview?.risks ?? []}
              renderItem={(item) => (
                <List.Item>
                  <Tag color="gold">待处理</Tag>
                  <Typography.Text>{item}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="设置入口" className="settings-section" loading={loading}>
        <Row gutter={[16, 16]}>
          {(overview?.entries ?? []).map((entry) => (
            <Col xs={24} md={12} xl={6} key={entry.key}>
              <Link to={entry.path}>
                <Card size="small" className="settings-entry-card">
                  <Space direction="vertical" size={8}>
                    <Typography.Text strong>{entry.title}</Typography.Text>
                    <Typography.Text className="muted">{entry.description}</Typography.Text>
                    <Tag color={entry.status === "warning" ? "gold" : "purple"}>
                      {entry.risk_count > 0 ? `${entry.risk_count} 项风险` : "可用"}
                    </Tag>
                  </Space>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} xl={14}>
          <Card title="销售账号" loading={loading}>
            <Table<SalesUser>
              rowKey="id"
              dataSource={overview?.sales_users ?? []}
              pagination={false}
              columns={[
                { title: "姓名", dataIndex: "name" },
                { title: "账号", dataIndex: "email" },
                { title: "角色", dataIndex: "role" },
                { title: "负责范围", dataIndex: "data_scope" },
                { title: "状态", render: (_, user) => (user.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>) }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            title="角色权限矩阵"
            loading={loading}
            extra={<Button type="primary" icon={<ShieldCheck size={16} />} loading={savingPermission} onClick={() => void savePermissions()}>保存权限</Button>}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Select value={selectedRole} options={roleOptions} onChange={setSelectedRole} />
              <Checkbox.Group
                value={permissionValues}
                options={permissionOptions}
                onChange={(values) => setPermissionValues(values.map(String))}
                className="permission-checkbox-group"
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="最近变更" className="settings-section" loading={loading}>
        <List
          dataSource={overview?.recent_changes ?? []}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" size={2}>
                <Typography.Text strong>{item.action}</Typography.Text>
                <Typography.Text className="muted">{item.detail}</Typography.Text>
              </Space>
              <Typography.Text className="muted">{new Date(item.created_at).toLocaleString()}</Typography.Text>
            </List.Item>
          )}
        />
      </Card>

      <Modal
        open={createOpen}
        title="新增销售"
        okText="保存账号"
        cancelText="取消"
        confirmLoading={creatingUser}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(values) => void submitSalesUser(values)}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true }, { type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true }, { min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="sales" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="dataScope" label="负责范围" initialValue="Latam" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
