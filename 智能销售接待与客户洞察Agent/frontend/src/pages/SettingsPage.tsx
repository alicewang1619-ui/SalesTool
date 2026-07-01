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
import { FileUp, ImageUp, Plus, Save, ShieldCheck, UserPlus, Users } from "lucide-react";
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
  type AIModelOption,
  type AIModelUseCase,
  type EmailWriterRole,
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
    },
    {
      value: "claude-sonnet",
      label: "Claude Sonnet",
      provider: "Anthropic",
      scenario: "邮件草稿和高价值客户触达",
      capability: "长文本写作、语气控制和复杂客户沟通",
      status: "available"
    },
    {
      value: "codex",
      label: "Codex",
      provider: "OpenAI",
      scenario: "AI 接待流程、结构化推理和内部工作流辅助",
      capability: "适合拆解流程、生成结构化摘要和工具化任务",
      status: "available"
    },
    {
      value: "deepseek-chat",
      label: "DeepSeek Chat",
      provider: "DeepSeek",
      scenario: "客户背景调研、中文资料整理和批量摘要",
      capability: "适合低成本批量分析和多语言背景摘要",
      status: "available"
    }
  ],
  use_cases: [
    {
      key: "default",
      label: "AI 接待与线索摘要",
      description: "用于官网接待、线索摘要、评分和通用 AI 辅助。"
    },
    {
      key: "email_draft",
      label: "邮件草稿",
      description: "用于再营销邮件草稿、触达理由和发送前人工确认内容。"
    },
    {
      key: "customer_research",
      label: "客户背景调研",
      description: "用于客户背景调查、公开资料摘要和客户画像补全。"
    }
  ],
  use_case_bindings: {
    default: "ug-balanced-v1",
    email_draft: "claude-sonnet",
    customer_research: "deepseek-chat"
  },
  email_writers: [
    {
      key: "doraemon",
      name: "Doraemon",
      display_name: "哆啦A梦",
      style: "温暖、可靠、什么都能帮你",
      skills: ["万能助手", "日常回复", "客户维护"],
      best_for: "万能助手、日常回复、客户维护",
      status: "enabled"
    },
    {
      key: "mario",
      name: "Mario",
      display_name: "超级马里奥",
      style: "积极、行动派、有冲劲",
      skills: ["销售跟进", "催单", "推动决策"],
      best_for: "销售跟进、催单、推动决策",
      status: "enabled"
    },
    {
      key: "pikachu",
      name: "Pikachu",
      display_name: "皮卡丘",
      style: "活泼、可爱、有亲和力",
      skills: ["社媒互动", "年轻客户", "轻松话题"],
      best_for: "社媒互动、年轻客户、轻松话题",
      status: "enabled"
    },
    {
      key: "totoro",
      name: "Totoro",
      display_name: "龙猫",
      style: "温柔、治愈、让人安心",
      skills: ["客户关怀", "节日问候", "暖心邮件"],
      best_for: "客户关怀、节日问候、暖心邮件",
      status: "enabled"
    },
    {
      key: "baymax",
      name: "Baymax",
      display_name: "大白",
      style: "稳重、专业、可靠",
      skills: ["正式邮件", "医疗客户", "技术沟通"],
      best_for: "正式邮件、医疗客户、技术沟通",
      status: "enabled"
    },
    {
      key: "nemo",
      name: "Nemo",
      display_name: "海底总动员",
      style: "好奇、探索、愿意沟通",
      skills: ["陌生开发", "初次接触", "破冰邮件"],
      best_for: "陌生开发、初次接触、破冰邮件",
      status: "enabled"
    }
  ],
  default_email_writer: "baymax",
  updated_by: null,
  updated_at: null
};

type TraceableError = Error & { traceId?: string };

type BannerImageMeta = {
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
};

type AccountFormValues = {
  name: string;
  email: string;
  password?: string;
  role: string;
  dataScope: string;
  enabled: boolean;
};

type AIModelFormValues = {
  provider: string;
  label: string;
  value?: string;
  scenario: string;
  capability: string;
};

type AIModelUseCaseFormValues = {
  key?: string;
  label: string;
  description: string;
};

type EmailWriterFormValues = {
  key?: string;
  name: string;
  displayName: string;
  style: string;
  skills: string;
  bestFor: string;
  status: string;
};

function asTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) return error as TraceableError;
  return new Error("设置管理加载失败");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normaliseAIModelConfig(config?: Partial<AIModelConfig> | null): AIModelConfig {
  return {
    ...fallbackAIModelConfig,
    ...config,
    options: config?.options?.length ? config.options : fallbackAIModelConfig.options,
    use_cases: config?.use_cases?.length ? config.use_cases : fallbackAIModelConfig.use_cases,
    use_case_bindings: {
      ...fallbackAIModelConfig.use_case_bindings,
      ...(config?.use_case_bindings ?? {})
    },
    email_writers: config?.email_writers?.length ? config.email_writers : fallbackAIModelConfig.email_writers,
    default_email_writer: config?.default_email_writer ?? fallbackAIModelConfig.default_email_writer
  };
}

function modelValueFrom(provider: string, label: string) {
  const source = `${provider}-${label}`.toLowerCase();
  return source
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function readBannerImage(file: File): Promise<{ url: string; meta: BannerImageMeta }> {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("Banner 仅支持 PNG、JPG 或 WebP 图片"));
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const targetWidth = 1920;
      const targetHeight = 360;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("浏览器无法处理 Banner 图片"));
        return;
      }
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = targetWidth / targetHeight;
      const sourceWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
      const sourceHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
      const sourceX = (image.naturalWidth - sourceWidth) / 2;
      const sourceY = (image.naturalHeight - sourceHeight) / 2;
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      const url = canvas.toDataURL("image/jpeg", 0.86);
      URL.revokeObjectURL(objectUrl);
      resolve({
        url,
        meta: {
          width: image.naturalWidth,
          height: image.naturalHeight,
          originalSize: file.size,
          compressedSize: Math.round((url.length * 3) / 4)
        }
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Banner 图片读取失败，请换一张 PNG/JPG/WebP"));
    };
    image.src = objectUrl;
  });
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [accountForm] = Form.useForm<AccountFormValues>();
  const [modelForm] = Form.useForm<AIModelFormValues>();
  const [scenarioForm] = Form.useForm<AIModelUseCaseFormValues>();
  const [writerForm] = Form.useForm<EmailWriterFormValues>();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [activeMenu, setActiveMenu] = useState(sectionMenuMap[searchParams.get("section") ?? ""] ?? "overview");
  const [loading, setLoading] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingPermission, setSavingPermission] = useState(false);
  const [savingAIModel, setSavingAIModel] = useState(false);
  const [savingModelOption, setSavingModelOption] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);
  const [savingWriterRole, setSavingWriterRole] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [writerModalOpen, setWriterModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SalesUser | null>(null);
  const [editingWriter, setEditingWriter] = useState<EmailWriterRole | null>(null);
  const [selectedRole, setSelectedRole] = useState("ops");
  const [permissionValues, setPermissionValues] = useState<string[]>([]);
  const [aiModelDraft, setAIModelDraft] = useState("ug-balanced-v1");
  const [aiModelUseCases, setAIModelUseCases] = useState<AIModelUseCase[]>(fallbackAIModelConfig.use_cases);
  const [aiModelBindings, setAIModelBindings] = useState<Record<string, string>>(fallbackAIModelConfig.use_case_bindings);
  const [emailWriters, setEmailWriters] = useState<EmailWriterRole[]>(fallbackAIModelConfig.email_writers);
  const [defaultEmailWriter, setDefaultEmailWriter] = useState(fallbackAIModelConfig.default_email_writer);
  const [bannerImageMeta, setBannerImageMeta] = useState<BannerImageMeta | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<TraceableError | null>(null);
  const [bannerDraft, setBannerDraft] = useState({
    title: "",
    body: "",
    imageUrl: "",
    linkUrl: ""
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
        linkUrl: result.banner.link_url ?? ""
      });
      const currentRole = result.permissions.find((row) => row.role === selectedRole) ?? result.permissions[0];
      if (currentRole) {
        setSelectedRole(currentRole.role);
        setPermissionValues(currentRole.permissions);
      }
      const nextAIModelConfig = normaliseAIModelConfig(result.ai_model);
      setAIModelDraft(nextAIModelConfig.selected_model);
      setAIModelUseCases(nextAIModelConfig.use_cases);
      setAIModelBindings(nextAIModelConfig.use_case_bindings);
      setEmailWriters(nextAIModelConfig.email_writers);
      setDefaultEmailWriter(nextAIModelConfig.default_email_writer);
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
  const aiModelConfig = normaliseAIModelConfig(overview?.ai_model);
  const selectedAIModel = useMemo(
    () => aiModelConfig.options.find((item) => item.value === aiModelDraft) ?? aiModelConfig.options[0],
    [aiModelConfig, aiModelDraft]
  );
  const enabledEmailWriters = useMemo(
    () => emailWriters.filter((writer) => writer.status === "enabled"),
    [emailWriters]
  );

  useEffect(() => {
    if (currentPermission) setPermissionValues(currentPermission.permissions);
  }, [currentPermission]);

  async function publishBanner() {
    setSavingBanner(true);
    setError(null);
    try {
      if (!bannerDraft.imageUrl) {
        throw new Error("请先上传 Banner 图片，建议 1920×360，PNG/JPG/WebP，不超过 2MB。");
      }
      await updateSettingsBanner({
        title: bannerDraft.title,
        body: bannerDraft.body,
        imageUrl: bannerDraft.imageUrl,
        linkUrl: null,
        active: true
      });
      setNotice("Banner 已发布到全部后台页面；普通页面只显示图片、标题和正文。");
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
      const bindings = { ...aiModelBindings, default: aiModelDraft };
      const saved = await updateSettingsAIModel({
        selectedModel: aiModelDraft,
        useCases: aiModelUseCases,
        useCaseBindings: bindings,
        emailWriters,
        defaultEmailWriter
      });
      setNotice(`AI 配置已保存：默认模型 ${saved.selected_label}，默认写手 ${saved.email_writers.find((writer) => writer.key === saved.default_email_writer)?.display_name ?? saved.default_email_writer}`);
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingAIModel(false);
    }
  }

  async function addAIModelOption(values: AIModelFormValues) {
    setSavingModelOption(true);
    setError(null);
    try {
      const option: AIModelOption = {
        value: (values.value?.trim() || modelValueFrom(values.provider, values.label)) || `model-${Date.now()}`,
        label: values.label.trim(),
        provider: values.provider.trim(),
        scenario: values.scenario.trim(),
        capability: values.capability.trim(),
        status: "available"
      };
      const options = [...aiModelConfig.options.filter((item) => item.value !== option.value), option];
      const saved = await updateSettingsAIModel({
        selectedModel: aiModelDraft,
        options,
        useCases: aiModelUseCases,
        useCaseBindings: { ...aiModelBindings, default: aiModelDraft },
        emailWriters,
        defaultEmailWriter
      });
      setNotice(`已添加模型选项：${option.label}`);
      setModelModalOpen(false);
      modelForm.resetFields();
      setAIModelBindings(saved.use_case_bindings);
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingModelOption(false);
    }
  }

  async function addAIModelUseCase(values: AIModelUseCaseFormValues) {
    setSavingScenario(true);
    setError(null);
    try {
      const key = (values.key?.trim() || modelValueFrom("scenario", values.label)) || `scenario-${Date.now()}`;
      const useCase: AIModelUseCase = {
        key,
        label: values.label.trim(),
        description: values.description.trim()
      };
      const nextUseCases = [...aiModelUseCases.filter((item) => item.key !== useCase.key), useCase];
      const nextBindings = { ...aiModelBindings, [useCase.key]: aiModelDraft, default: aiModelDraft };
      const saved = await updateSettingsAIModel({
        selectedModel: aiModelDraft,
        useCases: nextUseCases,
        useCaseBindings: nextBindings,
        emailWriters,
        defaultEmailWriter
      });
      setAIModelUseCases(saved.use_cases);
      setAIModelBindings(saved.use_case_bindings);
      setScenarioModalOpen(false);
      scenarioForm.resetFields();
      setNotice(`已添加模型场景：${useCase.label}`);
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingScenario(false);
    }
  }

  function openCreateWriter() {
    setEditingWriter(null);
    writerForm.resetFields();
    writerForm.setFieldsValue({ status: "enabled" });
    setWriterModalOpen(true);
  }

  function openEditWriter(writer: EmailWriterRole) {
    setEditingWriter(writer);
    writerForm.setFieldsValue({
      key: writer.key,
      name: writer.name,
      displayName: writer.display_name,
      style: writer.style,
      skills: writer.skills.join("、"),
      bestFor: writer.best_for,
      status: writer.status
    });
    setWriterModalOpen(true);
  }

  async function saveEmailWriterRole(values: EmailWriterFormValues) {
    setSavingWriterRole(true);
    setError(null);
    try {
      const key = (values.key?.trim() || editingWriter?.key || modelValueFrom("writer", values.name)) || `writer-${Date.now()}`;
      const writer: EmailWriterRole = {
        key,
        name: values.name.trim(),
        display_name: values.displayName.trim(),
        style: values.style.trim(),
        skills: values.skills.split(/[、,，\n]/).map((skill) => skill.trim()).filter(Boolean),
        best_for: values.bestFor.trim(),
        status: values.status
      };
      const nextWriters = [...emailWriters.filter((item) => item.key !== writer.key), writer];
      const nextDefaultWriter = defaultEmailWriter || writer.key;
      const saved = await updateSettingsAIModel({
        selectedModel: aiModelDraft,
        useCases: aiModelUseCases,
        useCaseBindings: { ...aiModelBindings, default: aiModelDraft },
        emailWriters: nextWriters,
        defaultEmailWriter: nextDefaultWriter
      });
      setEmailWriters(saved.email_writers);
      setDefaultEmailWriter(saved.default_email_writer);
      setWriterModalOpen(false);
      writerForm.resetFields();
      setEditingWriter(null);
      setNotice(`邮件写手角色已保存：${writer.display_name}`);
      await load();
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setSavingWriterRole(false);
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
          <Row gutter={[16, 16]} className="summary-grid">
            <Col xs={24} xl={14}>
              <Card
                id="sales-users"
                title="销售账号"
                loading={loading}
                extra={
                  <Space wrap>
                    <Button icon={<FileUp size={16} />} onClick={() => setNotice("账号批量导入将在账号管理内处理；当前可先用新增账号维护单个用户。")}>
                      导入账号
                    </Button>
                    <Button type="primary" icon={<UserPlus size={16} />} onClick={openCreateAccount}>
                      新增账号
                    </Button>
                  </Space>
                }
              >
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
                <Alert
                  showIcon
                  type="info"
                  message="Banner 图片建议"
                  description="推荐尺寸 1920×360，支持 PNG/JPG/WebP；建议原图不超过 2MB。上传后会自动裁切压缩为横幅比例，避免发布失败。"
                />
                <Upload
                  accept="image/png,image/jpeg,image/webp"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void readBannerImage(file as File)
                      .then(({ url, meta }) => {
                        setBannerDraft((current) => ({ ...current, imageUrl: url }));
                        setBannerImageMeta(meta);
                        setNotice(
                          `Banner 图片已载入预览：原图 ${meta.width}×${meta.height} / ${formatFileSize(meta.originalSize)}，压缩后约 ${formatFileSize(meta.compressedSize)}`
                        );
                      })
                      .catch((failure) => setError(asTraceableError(failure)));
                    return false;
                  }}
                >
                  <Button icon={<ImageUp size={16} />}>上传 Banner 图片</Button>
                </Upload>
                {bannerImageMeta ? (
                  <Tag color="purple">
                    原图 {bannerImageMeta.width}×{bannerImageMeta.height} · {formatFileSize(bannerImageMeta.originalSize)}，发布图 1920×360
                  </Tag>
                ) : null}
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
          <Col xs={24} xl={9}>
            <Card
              id="ai-model"
              title="选择大模型"
              loading={loading}
              extra={
                <Button type="primary" icon={<Save size={16} />} loading={savingAIModel} onClick={() => void saveAIModel()}>
                  保存配置
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Select
                  value={aiModelDraft}
                  options={aiModelConfig.options.map((item) => ({ value: item.value, label: item.label }))}
                  onChange={(value) => {
                    setAIModelDraft(value);
                    setAIModelBindings((current) => ({ ...current, default: value }));
                  }}
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
          <Col xs={24} xl={15}>
            <Card
              title="模型场景配置"
              loading={loading}
              extra={
                <Space wrap>
                  <Button icon={<Plus size={16} />} onClick={() => setScenarioModalOpen(true)}>
                    添加场景
                  </Button>
                  <Button icon={<Plus size={16} />} onClick={() => setModelModalOpen(true)}>
                    添加大模型
                  </Button>
                </Space>
              }
            >
              <Row gutter={[12, 12]}>
                {aiModelUseCases
                  .map((useCase) => (
                    <Col xs={24} md={12} key={useCase.key}>
                      <Card size="small" className="settings-entry-card">
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Typography.Text strong>{useCase.label}</Typography.Text>
                          <Typography.Text className="muted">{useCase.description}</Typography.Text>
                          <Select
                            value={aiModelBindings[useCase.key] ?? aiModelConfig.use_case_bindings[useCase.key] ?? aiModelDraft}
                            options={aiModelConfig.options.map((item) => ({ value: item.value, label: `${item.label} · ${item.provider}` }))}
                            onChange={(value) => setAIModelBindings((current) => ({ ...current, [useCase.key]: value }))}
                          />
                        </Space>
                      </Card>
                    </Col>
                  ))}
              </Row>
            </Card>
          </Col>
          <Col xs={24} xl={15}>
            <Card title="可选大模型" loading={loading}>
              <Table<AIModelOption>
                rowKey="value"
                dataSource={aiModelConfig.options}
                pagination={false}
                columns={[
                  { title: "模型", dataIndex: "label" },
                  { title: "供应商", dataIndex: "provider" },
                  { title: "适用场景", dataIndex: "scenario" },
                  { title: "能力说明", dataIndex: "capability" },
                  { title: "状态", dataIndex: "status", render: (statusValue: string) => <Tag color={statusValue === "available" ? "green" : "default"}>{statusValue}</Tag> }
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <Card title="产品知识入口" loading={loading}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Typography.Paragraph className="muted">
                  产品知识库仍然放在这里，作为客户背景调查、邮件草稿和 AI 接待的参考资料。
                </Typography.Paragraph>
                <Link to="/admin/settings/product-knowledge">
                  <Button>进入产品知识库</Button>
                </Link>
              </Space>
            </Card>
          </Col>
          <Col xs={24}>
            <Card
              title="邮件写手角色"
              loading={loading}
              extra={
                <Space wrap>
                  <Select
                    style={{ width: 180 }}
                    value={defaultEmailWriter}
                    options={enabledEmailWriters.map((writer) => ({ value: writer.key, label: `${writer.name} · ${writer.display_name}` }))}
                    onChange={setDefaultEmailWriter}
                  />
                  <Button icon={<Plus size={16} />} onClick={openCreateWriter}>
                    添加写手角色
                  </Button>
                </Space>
              }
            >
              <Table<EmailWriterRole>
                rowKey="key"
                dataSource={emailWriters}
                pagination={false}
                columns={[
                  {
                    title: "角色",
                    render: (_, writer) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>{writer.name}</Typography.Text>
                        <Typography.Text className="muted">{writer.display_name}</Typography.Text>
                      </Space>
                    )
                  },
                  { title: "风格", dataIndex: "style" },
                  {
                    title: "技能",
                    dataIndex: "skills",
                    render: (skills: string[]) => (
                      <Space wrap>
                        {skills.map((skill) => <Tag key={skill} color="purple">{skill}</Tag>)}
                      </Space>
                    )
                  },
                  { title: "适用场景", dataIndex: "best_for" },
                  { title: "状态", dataIndex: "status", render: (statusValue: string) => <Tag color={statusValue === "enabled" ? "green" : "default"}>{statusValue === "enabled" ? "启用" : "停用"}</Tag> },
                  {
                    title: "操作",
                    render: (_, writer) => (
                      <Button size="small" onClick={() => openEditWriter(writer)}>
                        编辑
                      </Button>
                    )
                  }
                ]}
              />
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
        open={modelModalOpen}
        title="添加大模型"
        okText="保存大模型"
        cancelText="取消"
        confirmLoading={savingModelOption}
        onCancel={() => setModelModalOpen(false)}
        onOk={() => modelForm.submit()}
      >
        <Form form={modelForm} layout="vertical" onFinish={(values) => void addAIModelOption(values)}>
          <Form.Item name="provider" label="模型供应商" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 Anthropic / OpenAI / DeepSeek" />
          </Form.Item>
          <Form.Item name="label" label="显示名称" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 Claude Sonnet / Codex / DeepSeek Chat" />
          </Form.Item>
          <Form.Item name="value" label="模型标识">
            <Input placeholder="可留空，系统会按供应商和名称生成" />
          </Form.Item>
          <Form.Item name="scenario" label="适用场景" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 邮件草稿 / 客户背景调研 / AI 接待" />
          </Form.Item>
          <Form.Item name="capability" label="能力说明" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="说明为什么选择这个模型，以及适合哪类任务" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={scenarioModalOpen}
        title="添加模型场景"
        okText="保存场景"
        cancelText="取消"
        confirmLoading={savingScenario}
        onCancel={() => setScenarioModalOpen(false)}
        onOk={() => scenarioForm.submit()}
      >
        <Form form={scenarioForm} layout="vertical" onFinish={(values) => void addAIModelUseCase(values)}>
          <Form.Item name="label" label="场景名称" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 客户背景调查 / 邮件草稿写作 / 报价后跟进" />
          </Form.Item>
          <Form.Item name="key" label="场景标识">
            <Input placeholder="可留空，系统按名称生成；例如 pricing_followup" />
          </Form.Item>
          <Form.Item name="description" label="场景说明" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="说明这个场景会用大模型完成什么任务" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={writerModalOpen}
        title={editingWriter ? "编辑邮件写手角色" : "添加邮件写手角色"}
        okText="保存写手角色"
        cancelText="取消"
        confirmLoading={savingWriterRole}
        onCancel={() => {
          setWriterModalOpen(false);
          setEditingWriter(null);
        }}
        onOk={() => writerForm.submit()}
      >
        <Form form={writerForm} layout="vertical" onFinish={(values) => void saveEmailWriterRole(values)}>
          <Form.Item name="name" label="英文角色" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 Doraemon / Mario / Baymax" />
          </Form.Item>
          <Form.Item name="displayName" label="中文名" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 哆啦A梦 / 超级马里奥 / 大白" />
          </Form.Item>
          <Form.Item name="key" label="角色标识">
            <Input disabled={Boolean(editingWriter)} placeholder="可留空，系统按英文角色生成" />
          </Form.Item>
          <Form.Item name="style" label="风格" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 稳重、专业、可靠" />
          </Form.Item>
          <Form.Item name="skills" label="技能" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="用顿号、逗号或换行分隔，例如 正式邮件、医疗客户、技术沟通" />
          </Form.Item>
          <Form.Item name="bestFor" label="适用场景" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="例如 正式邮件、医疗客户、技术沟通" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="enabled" rules={[{ required: true }]}>
            <Select options={[{ value: "enabled", label: "启用" }, { value: "disabled", label: "停用" }]} />
          </Form.Item>
        </Form>
      </Modal>

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
