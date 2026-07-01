import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload
} from "antd";
import { FileUp, History, ImageUp, Save, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createSalesUser,
  fetchSettingsOverview,
  updateSalesUser,
  updateSettingsAIModel,
  updateSettingsBanner,
  updateSettingsPermissions,
  type AIModelConfig,
  type SalesUser,
  type SettingsOverview
} from "../api";

const roleOptions = [
  { label: "管理员", value: "admin" },
  { label: "营销/运营", value: "ops" },
  { label: "销售", value: "sales" }
];

const permissionOptions = [
  { label: "配置管理", value: "settings.manage" },
  { label: "全局 Banner", value: "settings.banner.update" },
  { label: "用户管理", value: "users.manage" },
  { label: "报表查看", value: "reports.read" },
  { label: "报表导出", value: "reports.export" },
  { label: "线索查看", value: "leads.read" },
  { label: "客户查看", value: "customers.read" },
  { label: "销售范围线索", value: "leads.assigned.read" },
  { label: "提交反馈", value: "feedback.submit" }
];

const settingsMenuItems = [
  { key: "overview", label: "总览" },
  { key: "account", label: "账号权限" },
  { key: "banner", label: "全局 Banner" },
  { key: "routing", label: "线索分发" },
  { key: "ai", label: "AI 与模型" },
  { key: "audit", label: "配置审计" }
];

const sectionMenuMap: Record<string, string> = {
  "sales-users": "account",
  permissions: "account",
  banner: "banner",
  "country-sales": "routing",
  sources: "routing",
  channels: "routing",
  reminders: "routing",
  "product-knowledge": "ai",
  "ai-model": "ai",
  audit: "audit"
};

const entryMenuMap: Record<string, string> = {
  sales_accounts: "account",
  role_permissions: "account",
  global_banner: "banner",
  country_sales_mapping: "routing",
  source_dictionary: "routing",
  channels: "routing",
  reminder_rules: "routing",
  product_knowledge: "ai",
  ai_model_selection: "ai"
};

const fallbackAIModelConfig: AIModelConfig = {
  selected_model: "ug-balanced-v1",
  selected_label: "平衡模型（推荐）",
  provider: "Ultrasound Growth LLM",
  scenario: "AI 接待、客户摘要、评分和再营销草稿",
  options: [
    {
      value: "ug-fast-v1",
      label: "快速模型",
      provider: "Ultrasound Growth LLM",
      scenario: "线索预处理、短摘要、低延迟接待",
      capability: "响应快，适合高频批量任务",
      status: "available"
    },
    {
      value: "ug-balanced-v1",
      label: "平衡模型（推荐）",
      provider: "Ultrasound Growth LLM",
      scenario: "AI 接待、客户摘要、评分和再营销草稿",
      capability: "质量与速度平衡，默认推荐",
      status: "available"
    },
    {
      value: "ug-quality-v1",
      label: "高质量模型",
      provider: "Ultrasound Growth LLM",
      scenario: "复杂客户背景调查、长邮件草稿和高价值客户触达",
      capability: "推理更强，成本和耗时更高",
      status: "available"
    }
  ],
  updated_by: null,
  updated_at: null
};

type TraceableError = Error & { traceId?: string };

type AccountFormValues = {
  name: string;
  email: string;
  password?: string;
  role: string;
  dataScope: string;
  enabled: boolean;
};

function asTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) return error as TraceableError;
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
  const [searchParams] = useSearchParams();
  const [accountForm] = Form.useForm<AccountFormValues>();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [activeMenu, setActiveMenu] = useState(sectionMenuMap[searchParams.get("section") ?? ""] ?? "overview");
  const [loading, setLoading] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingPermission, setSavingPermission] = useState(false);
  const [savingAIModel, setSavingAIModel] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SalesUser | null>(null);
  const [selectedRole, setSelectedRole] = useState("ops");
  const [permissionValues, setPermissionValues] = useState<string[]>([]);
  const [aiModelDraft, setAIModelDraft] = useState("ug-balanced-v1");
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
      setAIModelDraft((result.ai_model ?? fallbackAIModelConfig).selected_model);
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const section = searchParams.get("section");
    if (!section) {
      setActiveMenu("overview");
      return;
    }
    setActiveMenu(sectionMenuMap[section] ?? "overview");
  }, [searchParams, overview]);

  const currentPermission = useMemo(() => overview?.permissions.find((row) => row.role === selectedRole), [overview, selectedRole]);
  const aiModelConfig = overview?.ai_model ?? fallbackAIModelConfig;
  const selectedAIModel = useMemo(
    () => aiModelConfig.options.find((item) => item.value === aiModelDraft) ?? aiModelConfig.options[0],
    [aiModelConfig, aiModelDraft]
  );

  useEffect(() => {
    if (currentPermission) setPermissionValues(currentPermission.permissions);
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
      setNotice("Banner 已发布到全部后台页面；普通页面不再显示管理入口。");
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
      setNotice("角色权限矩阵已保存并写入配置审计记录");
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingPermission(false);
    }
  }

  async function saveAIModel() {
    setSavingAIModel(true);
    setError(null);
    try {
      const saved = await updateSettingsAIModel({ selectedModel: aiModelDraft });
      setNotice(`大模型选择已保存：${saved.selected_label}`);
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingAIModel(false);
    }
  }

  function openCreateAccount() {
    setEditingAccount(null);
    accountForm.resetFields();
    accountForm.setFieldsValue({ role: "sales", dataScope: "Latam", enabled: true });
    setAccountModalOpen(true);
  }

  function openEditAccount(user: SalesUser) {
    setEditingAccount(user);
    accountForm.setFieldsValue({
      name: user.name,
      email: user.email,
      role: user.role,
      dataScope: user.data_scope,
      enabled: user.enabled
    });
    setAccountModalOpen(true);
  }

  async function submitAccount(values: AccountFormValues) {
    setSavingAccount(true);
    setError(null);
    try {
      if (editingAccount) {
        await updateSalesUser(editingAccount.id, values);
        setNotice("账号资料已更新，并写入配置审计记录");
      } else {
        await createSalesUser({
          name: values.name,
          email: values.email,
          password: values.password ?? "",
          role: values.role,
          dataScope: values.dataScope,
          enabled: values.enabled
        });
        setNotice("账号已创建，并写入配置审计记录");
      }
      setAccountModalOpen(false);
      accountForm.resetFields();
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingAccount(false);
    }
  }

  async function toggleAccount(user: SalesUser, enabled: boolean) {
    setSavingAccount(true);
    try {
      await updateSalesUser(user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
        dataScope: user.data_scope,
        enabled
      });
      setNotice(enabled ? "账号已启用" : "账号已停用");
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingAccount(false);
    }
  }

  function entryCards(menuKey: string) {
    const entries = (overview?.entries ?? []).filter((entry) => entryMenuMap[entry.key] === menuKey);
    if (!entries.length) return <Empty description="暂无该分组配置入口" />;
    return (
      <Row gutter={[16, 16]}>
        {entries.map((entry) => (
          <Col xs={24} md={12} xl={6} key={entry.key}>
            <Link to={entry.path}>
              <Card size="small" className="settings-entry-card" hoverable>
                <Space direction="vertical" size={8}>
                  <Typography.Text strong>{entry.title}</Typography.Text>
                  <Typography.Text className="muted">{entry.description}</Typography.Text>
                  <Tag color={entry.status === "warning" ? "gold" : "purple"}>
                    {entry.risk_count > 0 ? `${entry.risk_count} 项风险` : "可进入"}
                  </Tag>
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 系统配置</Typography.Text>
          <Typography.Title level={2}>配置中心</Typography.Title>
          <Typography.Paragraph className="muted">
            这里集中维护账号、角色权限、全局 Banner、国家销售映射、产品知识库、来源字典、渠道和提醒规则。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<FileUp size={16} />} onClick={() => setActiveMenu("account")}>
            导入账号
          </Button>
          <Button icon={<History size={16} />} onClick={() => setActiveMenu("audit")}>
            配置审计
          </Button>
          <Button
            type="primary"
            icon={<UserPlus size={16} />}
            onClick={() => {
              setActiveMenu("account");
              openCreateAccount();
            }}
          >
            新增账号
          </Button>
        </Space>
      </div>

      {notice ? <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} /> : null}
      {error ? <Alert type="error" showIcon message="设置操作失败" description={error.message} /> : null}

      <Tabs activeKey={activeMenu} items={settingsMenuItems} onChange={setActiveMenu} className="settings-section" />

      {activeMenu === "overview" ? (
        <>
          <Row gutter={[16, 16]} className="metric-row">
            <Col xs={24} md={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="销售账号" value={overview?.summary.sales_users ?? 0} prefix={<Users size={18} />} />
                <div className="metric-chip">管理员创建和维护账号</div>
              </Card>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="已启用来源" value={overview?.summary.sources ?? 0} />
                <div className="metric-chip green">决定线索来源筛选项</div>
              </Card>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="来源国家映射" value={overview?.summary.country_mappings ?? 0} />
                <div className="metric-chip amber">导入时自动分配销售</div>
              </Card>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Card loading={loading}>
                <Statistic title="可选大模型" value={overview?.summary.ai_models ?? 0} />
                <div className="metric-chip">当前：{aiModelConfig.selected_label}</div>
              </Card>
            </Col>
          </Row>

          <Alert
            showIcon
            type="info"
            className="login-error"
            message="配置页顶部菜单说明"
            description="请先在顶部选择配置菜单，再在下方处理对应设置。账号、Banner、线索分发、AI 与模型、审计记录分开呈现，避免一屏堆叠全部配置。"
          />

          <Card title="配置菜单总览" className="settings-section" loading={loading}>
            <Row gutter={[16, 16]}>
              {settingsMenuItems.filter((item) => item.key !== "overview").map((item) => (
                <Col xs={24} md={12} xl={6} key={item.key}>
                  <Card size="small" className="settings-entry-card" hoverable onClick={() => setActiveMenu(item.key)}>
                    <Typography.Text strong>{item.label}</Typography.Text>
                    <Typography.Paragraph className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                      点击后只显示该分组下的设置项。
                    </Typography.Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </>
      ) : null}

      {activeMenu === "account" ? (
        <>
          <Card title="账号权限入口" className="settings-section" loading={loading}>
            {entryCards("account")}
          </Card>
          <Row gutter={[16, 16]} className="summary-grid">
            <Col xs={24} xl={14}>
              <Card id="sales-users" title="销售账号" loading={loading}>
                <Table<SalesUser>
                  rowKey="id"
                  dataSource={overview?.sales_users ?? []}
                  pagination={false}
                  columns={[
                    { title: "姓名", dataIndex: "name" },
                    { title: "账号", dataIndex: "email" },
                    { title: "角色", dataIndex: "role", render: (role: string) => roleOptions.find((item) => item.value === role)?.label ?? role },
                    { title: "负责范围", dataIndex: "data_scope" },
                    { title: "状态", render: (_, user) => (user.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>) },
                    {
                      title: "操作",
                      render: (_, user) => (
                        <Space>
                          <Button size="small" onClick={() => openEditAccount(user)}>
                            编辑
                          </Button>
                          <Switch
                            size="small"
                            checked={user.enabled}
                            loading={savingAccount}
                            checkedChildren="启用"
                            unCheckedChildren="停用"
                            onChange={(enabled) => void toggleAccount(user, enabled)}
                          />
                        </Space>
                      )
                    }
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card
                id="permissions"
                title="角色权限矩阵"
                loading={loading}
                extra={
                  <Button type="primary" icon={<ShieldCheck size={16} />} loading={savingPermission} onClick={() => void savePermissions()}>
                    保存权限
                  </Button>
                }
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
        </>
      ) : null}

      {activeMenu === "banner" ? (
        <Card id="banner" title="全局 Banner 管理" loading={loading}>
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
              <div
                className="banner-preview"
                style={{
                  backgroundImage: `linear-gradient(105deg, rgba(17,24,39,.76), rgba(91,75,219,.72)), url(${bannerDraft.imageUrl})`
                }}
              >
                <strong>{bannerDraft.title}</strong>
                <span>{bannerDraft.body}</span>
              </div>
            </Col>
          </Row>
        </Card>
      ) : null}

      {activeMenu === "routing" ? (
        <>
          <Card title="线索分发入口" className="settings-section" loading={loading}>
            {entryCards("routing")}
          </Card>
          <Row gutter={[16, 16]} className="summary-grid">
            <Col xs={24} md={8}>
              <Card id="sources" title="客户来源字典">
                <Typography.Paragraph className="muted">
                  来源字典决定线索池的来源筛选项，例如官网、邮箱、Facebook、领英和线下展会。已启用来源会参与导入校验。
                </Typography.Paragraph>
                <Tag color="purple">当前可用来源 {overview?.summary.sources ?? 0} 个</Tag>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card id="channels" title="渠道配置">
                <Typography.Paragraph className="muted">
                  渠道配置用于维护 Webhook、邮箱同步和展会导入来源；异常会进入配置风险和导入失败提示。
                </Typography.Paragraph>
                <Tag color="gold">邮箱同步需重试时会提示</Tag>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card id="reminders" title="提醒规则">
                <Typography.Paragraph className="muted">
                  提醒规则控制 24h/48h 未反馈、待分配和再营销确认的提醒节奏，避免销售遗漏待办。
                </Typography.Paragraph>
                <Tag color="green">启用中</Tag>
              </Card>
            </Col>
          </Row>
        </>
      ) : null}

      {activeMenu === "ai" ? (
        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} xl={10}>
            <Card
              id="ai-model"
              title="大模型选择"
              loading={loading}
              extra={
                <Button type="primary" icon={<Save size={16} />} loading={savingAIModel} onClick={() => void saveAIModel()}>
                  保存模型
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Select
                  value={aiModelDraft}
                  options={aiModelConfig.options.map((item) => ({ value: item.value, label: item.label }))}
                  onChange={setAIModelDraft}
                />
                <Alert
                  showIcon
                  type="info"
                  message={selectedAIModel?.label ?? "请选择模型"}
                  description={selectedAIModel ? `${selectedAIModel.provider} · ${selectedAIModel.scenario} · ${selectedAIModel.capability}` : "模型配置加载中"}
                />
                <Tag color="purple">当前生效：{aiModelConfig.selected_label}</Tag>
              </Space>
            </Card>
          </Col>
          <Col xs={24} xl={14}>
            <Card title="产品与 AI 配置入口" loading={loading}>
              {entryCards("ai")}
            </Card>
          </Col>
        </Row>
      ) : null}

      {activeMenu === "audit" ? (
        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} xl={9}>
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
          <Col xs={24} xl={15}>
            <Card id="audit" title="配置审计记录" loading={loading}>
              <Alert
                showIcon
                type="info"
                className="login-error"
                message="这些不是无用消息"
                description="配置审计记录用于追踪谁在什么时候改了账号、权限、Banner、大模型、导入和再营销发送，方便回溯误操作。"
              />
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
          </Col>
        </Row>
      ) : null}

      <Modal
        open={accountModalOpen}
        title={editingAccount ? "编辑账号" : "新增账号"}
        okText="保存账号"
        cancelText="取消"
        confirmLoading={savingAccount}
        onCancel={() => setAccountModalOpen(false)}
        onOk={() => accountForm.submit()}
      >
        <Form form={accountForm} layout="vertical" onFinish={(values) => void submitAccount(values)}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true }, { type: "email" }]}>
            <Input />
          </Form.Item>
          {!editingAccount ? (
            <Form.Item name="password" label="初始密码" rules={[{ required: true }, { min: 8 }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item name="role" label="角色" initialValue="sales" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="dataScope" label="负责范围" initialValue="Latam" rules={[{ required: true }]}>
            <Input placeholder="例如：Latam / Brazil, Peru" />
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked" initialValue>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
