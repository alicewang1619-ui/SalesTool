
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
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
  Upload,
  message
} from "antd";
import { ImageUp, Mail, Plus, RefreshCw, Save, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createSalesUser,
  deleteSalesUser,
  fetchSettingsOverview,
  updateSalesUser,
  updateSettingsAIModel,
  updateSettingsBanner,
  updateSettingsChannels,
  updateSettingsMail,
  updateSettingsPermissions,
  updateSettingsReminderRules,
  updateSettingsSourceDictionary,
  type AIModelConfig,
  type AIModelOption,
  type AIModelUseCase,
  type ChannelConfig,
  type EmailWriterRole,
  type GlobalMailSettings,
  type ReminderRule,
  type SalesUser,
  type SettingsOverview,
  type SourceDictionarySetting
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
  { key: "mail", label: "邮件接口" },
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
  mail: "mail",
  "product-knowledge": "ai",
  "ai-model": "ai",
  audit: "audit"
};

const fallbackModels: AIModelOption[] = [
  { value: "ug-balanced-v1", label: "平衡模型（推荐）", provider: "Ultrasound Growth LLM", scenario: "AI 接待、客户摘要、评分和再营销草稿", capability: "质量与速度平衡", status: "available" },
  { value: "claude-sonnet", label: "Claude Sonnet", provider: "Anthropic", scenario: "邮件草稿和高价值客户触达", capability: "长文本写作和语气控制", status: "available" },
  { value: "codex", label: "Codex", provider: "OpenAI", scenario: "结构化推理与内部工作流辅助", capability: "流程拆解和结构化摘要", status: "available" },
  { value: "deepseek-chat", label: "DeepSeek Chat", provider: "DeepSeek", scenario: "客户背景调研和批量摘要", capability: "低成本批量分析和多语言摘要", status: "available" }
];

const fallbackUseCases: AIModelUseCase[] = [
  { key: "customer_research", label: "客户背景调查", description: "用于客户公开资料、邮箱域名和历史互动摘要。" },
  { key: "email_draft", label: "邮件草稿写作", description: "用于按客户情况生成再营销邮件草稿。" }
];

const fallbackWriters: EmailWriterRole[] = [
  { key: "doraemon", name: "Doraemon", display_name: "哆啦A梦", style: "温暖、可靠、什么都能帮你", skills: ["万能助手", "日常回复"], best_for: "万能助手、日常回复、客户维护", status: "enabled" },
  { key: "mario", name: "Mario", display_name: "超级马里奥", style: "积极、行动派、有冲劲", skills: ["销售跟进", "推动决策"], best_for: "销售跟进、催单、推动决策", status: "enabled" },
  { key: "pikachu", name: "Pikachu", display_name: "皮卡丘", style: "活泼、可爱、有亲和力", skills: ["社媒互动", "轻松话题"], best_for: "社媒互动、年轻客户、轻松话题", status: "enabled" },
  { key: "totoro", name: "Totoro", display_name: "龙猫", style: "温柔、治愈、让人安心", skills: ["客户关怀", "暖心邮件"], best_for: "客户关怀、节日问候、暖心邮件", status: "enabled" },
  { key: "baymax", name: "Baymax", display_name: "大白", style: "稳重、专业、可靠", skills: ["正式邮件", "技术沟通"], best_for: "正式邮件、医疗客户、技术沟通", status: "enabled" },
  { key: "nemo", name: "Nemo", display_name: "海底总动员", style: "好奇、探索、愿意沟通", skills: ["陌生开发", "破冰邮件"], best_for: "陌生开发、初次接触、破冰邮件", status: "enabled" }
];

const knowledgeBaseLinks = [
  { key: "product", label: "产品知识库", description: "维护型号、应用场景和 AI 接待知识。" },
  { key: "competitor", label: "竞品知识库", description: "沉淀竞品对比、优势差异和销售话术。" },
  { key: "market", label: "市场知识库", description: "整理国家市场、渠道趋势和区域策略。" }
];

const fallbackAIModelConfig: AIModelConfig = {
  selected_model: "ug-balanced-v1",
  selected_label: "平衡模型（推荐）",
  provider: "Ultrasound Growth LLM",
  scenario: "AI 接待、客户摘要、评分和再营销草稿",
  options: fallbackModels,
  use_cases: fallbackUseCases,
  use_case_bindings: { customer_research: "deepseek-chat", email_draft: "claude-sonnet", default: "ug-balanced-v1" },
  email_writers: fallbackWriters,
  default_email_writer: "baymax",
  updated_by: null,
  updated_at: null
};

type AccountFormValues = { name: string; email: string; password?: string; role: string; dataScope: string; enabled: boolean };
type MailDraft = { senderEmail: string; senderName: string; smtpHost: string; smtpPort: number; username: string; password: string; useTls: boolean; enabled: boolean; testSendTo: string };
type BannerImageMeta = { width: number; height: number; originalSize: number; compressedSize: number };

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("设置操作失败");
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
    use_case_bindings: { ...fallbackAIModelConfig.use_case_bindings, ...(config?.use_case_bindings ?? {}) },
    email_writers: config?.email_writers?.length ? config.email_writers : fallbackAIModelConfig.email_writers,
    default_email_writer: config?.default_email_writer ?? fallbackAIModelConfig.default_email_writer
  };
}

function modelValueFrom(provider: string, label: string) {
  return `${provider}-${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || `model-${Date.now()}`;
}

function mailDraftFrom(settings?: GlobalMailSettings): MailDraft {
  return {
    senderEmail: settings?.sender_email || "sales@ultrasound-growth.local",
    senderName: settings?.sender_name || "Ultrasound Growth",
    smtpHost: settings?.smtp_host || "",
    smtpPort: settings?.smtp_port || 587,
    username: settings?.username || "",
    password: "",
    useTls: settings?.use_tls ?? true,
    enabled: settings?.enabled ?? false,
    testSendTo: ""
  };
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
      const canvas = document.createElement("canvas");
      const targetWidth = 1920;
      const targetHeight = 360;
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
      context.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
      const url = canvas.toDataURL("image/jpeg", 0.86);
      URL.revokeObjectURL(objectUrl);
      resolve({ url, meta: { width: image.naturalWidth, height: image.naturalHeight, originalSize: file.size, compressedSize: Math.round((url.length * 3) / 4) } });
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
  const [modelForm] = Form.useForm<AIModelOption & { apiKey?: string }>();
  const [writerForm] = Form.useForm<EmailWriterRole & { skillsText?: string }>();
  const [useCaseForm] = Form.useForm<AIModelUseCase>();
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [activeMenu, setActiveMenu] = useState(sectionMenuMap[searchParams.get("section") ?? ""] ?? "overview");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SalesUser | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [selectedRole, setSelectedRole] = useState("ops");
  const [permissionValues, setPermissionValues] = useState<string[]>([]);
  const [savingPermission, setSavingPermission] = useState(false);
  const [bannerDraft, setBannerDraft] = useState({ title: "", body: "", imageUrl: "" });
  const [bannerImageMeta, setBannerImageMeta] = useState<BannerImageMeta | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [sourceRows, setSourceRows] = useState<SourceDictionarySetting[]>([]);
  const [channelRows, setChannelRows] = useState<ChannelConfig[]>([]);
  const [reminderRows, setReminderRows] = useState<ReminderRule[]>([]);
  const [savingRouting, setSavingRouting] = useState(false);
  const [mailDraft, setMailDraft] = useState<MailDraft>(mailDraftFrom());
  const [savingMail, setSavingMail] = useState(false);
  const [aiModelDraft, setAIModelDraft] = useState("ug-balanced-v1");
  const [modelOptions, setModelOptions] = useState<AIModelOption[]>(fallbackModels);
  const [aiModelUseCases, setAIModelUseCases] = useState<AIModelUseCase[]>(fallbackUseCases);
  const [aiModelBindings, setAIModelBindings] = useState<Record<string, string>>(fallbackAIModelConfig.use_case_bindings);
  const [emailWriters, setEmailWriters] = useState<EmailWriterRole[]>(fallbackWriters);
  const [defaultEmailWriter, setDefaultEmailWriter] = useState("baymax");
  const [savingAIModel, setSavingAIModel] = useState(false);
  const [selectedSourceCategory, setSelectedSourceCategory] = useState("网站");
  const [selectedUseCaseKey, setSelectedUseCaseKey] = useState("email_draft");
  const [selectedModelValue, setSelectedModelValue] = useState("ug-balanced-v1");
  const [selectedWriterKey, setSelectedWriterKey] = useState("baymax");
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
  const [useCaseModalOpen, setUseCaseModalOpen] = useState(false);
  const [writerModalOpen, setWriterModalOpen] = useState(false);
  const [editingWriterIndex, setEditingWriterIndex] = useState<number | null>(null);

  const aiModelConfig = normaliseAIModelConfig({ ...overview?.ai_model, options: modelOptions, use_cases: aiModelUseCases, use_case_bindings: aiModelBindings, email_writers: emailWriters, default_email_writer: defaultEmailWriter });
  const selectedAIModel = aiModelConfig.options.find((item) => item.value === aiModelDraft) ?? aiModelConfig.options[0];
  const enabledEmailWriters = useMemo(() => emailWriters.filter((writer) => writer.status === "enabled"), [emailWriters]);
  const currentPermission = useMemo(() => overview?.permissions.find((row) => row.role === selectedRole), [overview, selectedRole]);
  const sourceCategories = useMemo(() => {
    const categories = Array.from(new Set(sourceRows.map((row) => row.category || "未分组")));
    return categories.length ? categories : ["网站"];
  }, [sourceRows]);
  const selectedSourceRows = useMemo(
    () => sourceRows.map((row, index) => ({ row, index })).filter((item) => (item.row.category || "未分组") === selectedSourceCategory),
    [selectedSourceCategory, sourceRows]
  );
  const modelSelectOptions = useMemo(
    () => modelOptions.map((item) => ({ value: item.value, label: `${item.label || item.value} · ${item.provider || "未填供应商"}` })),
    [modelOptions]
  );
  const availableModelSelectOptions = useMemo(
    () => modelOptions.map((item) => ({
      value: item.value,
      label: `${item.label || item.value} · ${item.provider || "未填供应商"}${item.status === "disabled" ? "（已停用）" : ""}`,
      disabled: item.status === "disabled"
    })),
    [modelOptions]
  );
  const selectedUseCase = useMemo(
    () => aiModelUseCases.find((item) => item.key === selectedUseCaseKey) ?? aiModelUseCases[0],
    [aiModelUseCases, selectedUseCaseKey]
  );
  const selectedBindingValue = selectedUseCase ? aiModelBindings[selectedUseCase.key] ?? aiModelDraft : aiModelDraft;
  const selectedBindingModel = modelOptions.find((item) => item.value === selectedBindingValue) ?? selectedAIModel;
  const selectedModelForDetails = modelOptions.find((item) => item.value === selectedModelValue) ?? modelOptions[0];
  const selectedWriterForDetails = emailWriters.find((writer) => writer.key === selectedWriterKey) ?? enabledEmailWriters[0] ?? emailWriters[0];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSettingsOverview();
      const config = normaliseAIModelConfig(result.ai_model);
      setOverview(result);
      setBannerDraft({ title: result.banner.title, body: result.banner.body, imageUrl: result.banner.image_url });
      const currentRole = result.permissions.find((row) => row.role === selectedRole) ?? result.permissions[0];
      if (currentRole) {
        setSelectedRole(currentRole.role);
        setPermissionValues(currentRole.permissions);
      }
      setAIModelDraft(config.selected_model);
      setModelOptions(config.options);
      setAIModelUseCases(config.use_cases);
      setAIModelBindings(config.use_case_bindings);
      setEmailWriters(config.email_writers);
      setDefaultEmailWriter(config.default_email_writer);
      setSelectedUseCaseKey((current) => config.use_cases.some((item) => item.key === current) ? current : config.use_cases[0]?.key ?? "email_draft");
      setSelectedModelValue((current) => config.options.some((item) => item.value === current) ? current : config.selected_model);
      setSelectedWriterKey((current) => config.email_writers.some((writer) => writer.key === current) ? current : config.default_email_writer);
      const nextSources = result.source_dictionary ?? [];
      setSourceRows(nextSources);
      setSelectedSourceCategory((current) => nextSources.some((row) => row.category === current) ? current : nextSources[0]?.category ?? "网站");
      setChannelRows(result.channel_configs ?? []);
      setReminderRows(result.reminder_rules ?? []);
      setMailDraft(mailDraftFrom(result.mail_settings));
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const section = searchParams.get("section");
    setActiveMenu(section ? sectionMenuMap[section] ?? "overview" : "overview");
  }, [searchParams]);

  useEffect(() => {
    if (currentPermission) setPermissionValues(currentPermission.permissions);
  }, [currentPermission]);

  function updateSourceRow(index: number, patch: Partial<SourceDictionarySetting>) {
    setSourceRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function updateChannelRow(index: number, patch: Partial<ChannelConfig>) {
    setChannelRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function updateReminderRow(index: number, patch: Partial<ReminderRule>) {
    setReminderRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function updateModelRow(index: number, patch: Partial<AIModelOption>) {
    setModelOptions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function updateUseCaseRow(index: number, patch: Partial<AIModelUseCase>) {
    setAIModelUseCases((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function updateWriterRow(index: number, patch: Partial<EmailWriterRole> & { skillsText?: string }) {
    setEmailWriters((rows) => rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (patch.skillsText !== undefined) {
        const { skillsText, ...rest } = patch;
        return { ...row, ...rest, skills: skillsText.split(/[、,，\n]/).map((skill) => skill.trim()).filter(Boolean) };
      }
      return { ...row, ...patch };
    }));
  }

  function addSourceForSelectedCategory() {
    setSourceRows((rows) => [...rows, { id: null, category: selectedSourceCategory || "网站", label: "", enabled: true }]);
  }

  function openCreateUseCase() {
    useCaseForm.setFieldsValue({ key: `scene_${Date.now()}`, label: "", description: "" });
    setUseCaseModalOpen(true);
  }

  function submitUseCase(values: AIModelUseCase) {
    const clean = {
      key: values.key.trim(),
      label: values.label.trim(),
      description: values.description.trim()
    };
    setAIModelUseCases((rows) => [...rows.filter((item) => item.key !== clean.key), clean]);
    setAIModelBindings((bindings) => ({ ...bindings, [clean.key]: bindings[clean.key] ?? aiModelDraft }));
    setSelectedUseCaseKey(clean.key);
    setUseCaseModalOpen(false);
  }

  function openCreateModel() {
    setEditingModelIndex(null);
    modelForm.setFieldsValue({
      value: modelValueFrom("provider", `model-${Date.now()}`),
      label: "",
      provider: "",
      scenario: "",
      capability: "",
      status: "available",
      api_base_url: "",
      endpoint_path: "/v1/chat/completions",
      auth_type: "bearer",
      api_key_configured: false,
      apiKey: ""
    });
    setModelModalOpen(true);
  }

  function openEditModel(index: number) {
    const model = modelOptions[index];
    setEditingModelIndex(index);
    modelForm.setFieldsValue({ ...model, apiKey: "" });
    setModelModalOpen(true);
  }

  function submitModel(values: AIModelOption & { apiKey?: string }) {
    const { apiKey, ...rest } = values;
    const nextModel: AIModelOption = {
      ...rest,
      value: (rest.value || modelValueFrom(rest.provider, rest.label)).trim(),
      label: rest.label.trim(),
      provider: rest.provider.trim(),
      scenario: rest.scenario.trim(),
      capability: rest.capability.trim(),
      status: rest.status || "available",
      api_base_url: rest.api_base_url?.trim() ?? "",
      endpoint_path: rest.endpoint_path?.trim() ?? "",
      auth_type: rest.auth_type || "bearer",
      api_key_configured: Boolean(apiKey?.trim()) || rest.api_key_configured === true,
      api_key: apiKey?.trim() || undefined
    };
    setModelOptions((rows) => {
      if (editingModelIndex === null) return [...rows, nextModel];
      return rows.map((row, index) => index === editingModelIndex ? nextModel : row);
    });
    setAIModelDraft((current) => current || nextModel.value);
    setSelectedModelValue(nextModel.value);
    setModelModalOpen(false);
  }

  function firstAvailableModelValue(rows = modelOptions) {
    return rows.find((item) => item.status !== "disabled")?.value ?? rows[0]?.value ?? "";
  }

  function toggleSelectedModel(checked: boolean) {
    const target = selectedModelForDetails;
    if (!target) return;
    if (!checked && modelOptions.filter((item) => item.status !== "disabled").length <= 1) {
      setError(new Error("至少需要保留一个启用的大模型。"));
      return;
    }
    const nextModels = modelOptions.map((item) => item.value === target.value ? { ...item, status: checked ? "available" : "disabled" } : item);
    const fallbackValue = firstAvailableModelValue(nextModels);
    setModelOptions(nextModels);
    if (!checked) {
      setAIModelDraft((current) => current === target.value ? fallbackValue : current);
      setAIModelBindings((bindings) => Object.fromEntries(Object.entries(bindings).map(([key, value]) => [key, value === target.value ? fallbackValue : value])));
    } else {
      setSelectedModelValue(target.value);
    }
    setNotice(checked ? "大模型已在当前草稿中开启，请点击保存模型库生效。" : "大模型已在当前草稿中停用，相关场景已自动回退，请点击保存模型库生效。");
  }

  function openCreateWriter() {
    setEditingWriterIndex(null);
    writerForm.setFieldsValue({
      key: `writer_${Date.now()}`,
      name: "",
      display_name: "",
      style: "",
      skillsText: "",
      best_for: "",
      status: "enabled"
    });
    setWriterModalOpen(true);
  }

  function openEditWriter(index: number) {
    const writer = emailWriters[index];
    setEditingWriterIndex(index);
    writerForm.setFieldsValue({ ...writer, skillsText: writer.skills.join("、") });
    setWriterModalOpen(true);
  }

  function submitWriter(values: EmailWriterRole & { skillsText?: string }) {
    const skills = (values.skillsText || "")
      .split(/[、,，\n]/)
      .map((skill) => skill.trim())
      .filter(Boolean);
    const nextWriter: EmailWriterRole = {
      key: values.key.trim(),
      name: values.name.trim(),
      display_name: values.display_name.trim(),
      style: values.style.trim(),
      skills,
      best_for: values.best_for.trim(),
      status: values.status || "enabled"
    };
    setEmailWriters((rows) => {
      if (editingWriterIndex === null) return [...rows, nextWriter];
      return rows.map((row, index) => index === editingWriterIndex ? nextWriter : row);
    });
    setSelectedWriterKey(nextWriter.key);
    setDefaultEmailWriter((current) => current || nextWriter.key);
    setWriterModalOpen(false);
  }

  async function publishBanner() {
    setSavingBanner(true);
    setError(null);
    try {
      if (!bannerDraft.imageUrl) throw new Error("请先上传 Banner 图片，建议 1920×360，PNG/JPG/WebP，原图不超过 2MB。");
      const saved = await updateSettingsBanner({ title: bannerDraft.title, body: bannerDraft.body, imageUrl: bannerDraft.imageUrl, linkUrl: null, active: true });
      setBannerDraft({ title: saved.title, body: saved.body, imageUrl: saved.image_url });
      setOverview((current) => current ? { ...current, banner: saved } : current);
      window.dispatchEvent(new CustomEvent("global-banner-updated", { detail: saved }));
      setNotice("Banner 已发布并同步刷新到全部后台页面。");
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSavingBanner(false);
    }
  }

  async function savePermissions() {
    setSavingPermission(true);
    setError(null);
    try {
      await updateSettingsPermissions({ role: selectedRole, permissions: permissionValues });
      setNotice("角色权限矩阵已保存。");
      await load();
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSavingPermission(false);
    }
  }

  async function submitAccount(values: AccountFormValues) {
    setSavingAccount(true);
    setError(null);
    try {
      if (editingAccount) {
        await updateSalesUser(editingAccount.id, values);
        setNotice("账号资料已更新。");
      } else {
        await createSalesUser({ name: values.name, email: values.email, password: values.password ?? "", role: values.role, dataScope: values.dataScope, enabled: values.enabled });
        setNotice("账号已创建。");
      }
      setAccountModalOpen(false);
      accountForm.resetFields();
      await load();
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSavingAccount(false);
    }
  }

  async function toggleAccount(user: SalesUser, enabled: boolean) {
    setSavingAccount(true);
    try {
      await updateSalesUser(user.id, { name: user.name, email: user.email, role: user.role, dataScope: user.data_scope, enabled });
      setNotice(enabled ? "账号已启用" : "账号已停用");
      await load();
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSavingAccount(false);
    }
  }

  async function saveRouting(kind: "source" | "channel" | "reminder") {
    setSavingRouting(true);
    setError(null);
    try {
      if (kind === "source") {
        const saved = await updateSettingsSourceDictionary(sourceRows.filter((row) => row.category.trim() && row.label.trim()));
        setSourceRows(saved);
        setNotice("客户来源字典已保存，线索筛选和导入校验会使用这些来源。");
      }
      if (kind === "channel") {
        const saved = await updateSettingsChannels(channelRows.filter((row) => row.key.trim() && row.name.trim() && row.source_category.trim() && row.access_method.trim()));
        setChannelRows(saved);
        setNotice("渠道配置已保存。");
      }
      if (kind === "reminder") {
        const saved = await updateSettingsReminderRules(reminderRows.filter((row) => row.key.trim() && row.name.trim() && row.target.trim() && row.channel.trim()));
        setReminderRows(saved);
        setNotice("提醒规则已保存。");
      }
      await load();
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSavingRouting(false);
    }
  }

  async function saveMailSettings() {
    setSavingMail(true);
    setError(null);
    try {
      const saved = await updateSettingsMail(mailDraft);
      setMailDraft(mailDraftFrom(saved));
      setNotice(saved.configured ? "邮件接口已保存并通过配置校验。" : "邮件接口已保存，但尚未启用或缺少 SMTP 主机。");
      await load();
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSavingMail(false);
    }
  }

  async function saveAIModel() {
    setSavingAIModel(true);
    setError(null);
    try {
      const cleanModels = modelOptions.filter((item) => item.value.trim() && item.label.trim() && item.provider.trim());
      const availableModels = cleanModels.filter((item) => item.status !== "disabled");
      if (!availableModels.length) throw new Error("至少需要保留一个启用的大模型。");
      const safeDefaultModel = availableModels.some((item) => item.value === aiModelDraft) ? aiModelDraft : availableModels[0].value;
      const availableValues = new Set(availableModels.map((item) => item.value));
      const safeBindings = Object.fromEntries(Object.entries(aiModelBindings).map(([key, value]) => [key, availableValues.has(value) ? value : safeDefaultModel]));
      const cleanUseCases = aiModelUseCases.filter((item) => item.key.trim() && item.label.trim());
      const cleanWriters = emailWriters.filter((item) => item.key.trim() && item.name.trim() && item.display_name.trim());
      const saved = await updateSettingsAIModel({
        selectedModel: safeDefaultModel,
        options: cleanModels,
        useCases: cleanUseCases,
        useCaseBindings: { ...safeBindings, default: safeDefaultModel },
        emailWriters: cleanWriters,
        defaultEmailWriter
      });
      setNotice(`AI 配置已保存：默认模型 ${saved.selected_label}，默认写手 ${saved.email_writers.find((writer) => writer.key === saved.default_email_writer)?.display_name ?? saved.default_email_writer}`);
      await load();
    } catch (failure) {
      setError(asError(failure));
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
    accountForm.setFieldsValue({ name: user.name, email: user.email, role: user.role, dataScope: user.data_scope, enabled: user.enabled });
    setAccountModalOpen(true);
  }

  function confirmDeleteAccount() {
    if (!editingAccount) return;
    Modal.confirm({
      title: "确认删除账号？",
      content: `删除 ${editingAccount.name} 后，若该账号没有历史反馈记录，将从账号列表移除；已分配线索/客户会变为未分配。`,
      okText: "删除账号",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        setSavingAccount(true);
        setError(null);
        try {
          const result = await deleteSalesUser(editingAccount.id);
          setNotice(`账号已删除，释放线索 ${result.affected_leads} 条、客户 ${result.affected_customers} 个。`);
          setAccountModalOpen(false);
          setEditingAccount(null);
          await load();
        } catch (failure) {
          setError(asError(failure));
          throw failure;
        } finally {
          setSavingAccount(false);
        }
      }
    });
  }

  function deleteSelectedUseCase() {
    const target = selectedUseCase;
    if (!target) return;
    if (aiModelUseCases.length <= 1) {
      setError(new Error("至少需要保留一个模型场景。"));
      return;
    }
    Modal.confirm({
      title: "删除模型场景？",
      content: `将删除“${target.label}”，并移除它与大模型的绑定。删除后请点击“保存配置”生效。`,
      okText: "删除场景",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const nextUseCases = aiModelUseCases.filter((item) => item.key !== target.key);
        setAIModelUseCases(nextUseCases);
        setAIModelBindings((bindings) => {
          const next = { ...bindings };
          delete next[target.key];
          return next;
        });
        setSelectedUseCaseKey(nextUseCases[0]?.key ?? "default");
        setNotice("模型场景已从当前草稿删除，请点击保存配置。");
      }
    });
  }

  function deleteSelectedModel() {
    const target = selectedModelForDetails;
    if (!target) return;
    if (modelOptions.length <= 1) {
      setError(new Error("至少需要保留一个大模型。"));
      return;
    }
    Modal.confirm({
      title: "删除大模型？",
      content: `将删除“${target.label}”，所有绑定到该模型的场景会切换到其他可用模型。删除后请点击“保存模型库”生效。`,
      okText: "删除模型",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const nextModels = modelOptions.filter((item) => item.value !== target.value);
        const fallbackValue = nextModels[0]?.value ?? "";
        setModelOptions(nextModels);
        setSelectedModelValue(fallbackValue);
        setAIModelDraft((current) => current === target.value ? fallbackValue : current);
        setAIModelBindings((bindings) => Object.fromEntries(
          Object.entries(bindings).map(([key, value]) => [key, value === target.value ? fallbackValue : value])
        ));
        setNotice("大模型已从当前草稿删除，请点击保存模型库。");
      }
    });
  }

  function deleteSelectedWriter() {
    const target = selectedWriterForDetails;
    if (!target) return;
    if (emailWriters.length <= 1) {
      setError(new Error("至少需要保留一个邮件写手。"));
      return;
    }
    Modal.confirm({
      title: "删除邮件写手？",
      content: `将删除“${target.display_name} / ${target.name}”。若它是默认写手，将自动切换到其他启用写手。删除后请点击“保存写手配置”生效。`,
      okText: "删除写手",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const nextWriters = emailWriters.filter((writer) => writer.key !== target.key);
        const fallbackKey = nextWriters.find((writer) => writer.status === "enabled")?.key ?? nextWriters[0]?.key ?? "";
        setEmailWriters(nextWriters);
        setSelectedWriterKey(fallbackKey);
        setDefaultEmailWriter((current) => current === target.key ? fallbackKey : current);
        setNotice("邮件写手已从当前草稿删除，请点击保存写手配置。");
      }
    });
  }

  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 系统配置</Typography.Text>
          <Typography.Title level={2}>配置中心</Typography.Title>
          <Typography.Paragraph className="muted">顶部菜单按账号权限、Banner、线索分发、邮件接口、AI 与模型、配置审计分组；点击菜单后只展示对应配置。</Typography.Paragraph>
        </div>
      </div>

      {notice ? <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} /> : null}
      {error ? <Alert type="error" showIcon message="设置操作失败" description={error.message} /> : null}
      <Tabs activeKey={activeMenu} items={settingsMenuItems} onChange={setActiveMenu} className="settings-section" />

      {activeMenu === "overview" ? (
        <>
          <Row gutter={[16, 16]} className="metric-row">
            <Col xs={24} md={12} xl={6}><Card loading={loading}><Statistic title="销售账号" value={overview?.summary.sales_users ?? 0} prefix={<Users size={18} />} /><div className="metric-chip">账号创建和权限维护在“账号权限”菜单</div></Card></Col>
            <Col xs={24} md={12} xl={6}><Card loading={loading}><Statistic title="已启用来源" value={overview?.summary.sources ?? 0} /><div className="metric-chip green">用于线索筛选与导入校验</div></Card></Col>
            <Col xs={24} md={12} xl={6}><Card loading={loading}><Statistic title="国家销售映射" value={overview?.summary.country_mappings ?? 0} /><div className="metric-chip amber">导入时自动分配销售</div></Card></Col>
            <Col xs={24} md={12} xl={6}><Card loading={loading}><Statistic title="邮件接口" value={overview?.summary.mail_configured ? "已配置" : "未配置"} /><div className="metric-chip">再营销发信读取这里的主邮箱</div></Card></Col>
          </Row>
          <Alert showIcon type="info" className="login-error" message="配置中心不再重复展示入口" description="请使用顶部菜单切换配置分组，下方只展示当前分组的真实配置内容。" />
        </>
      ) : null}

      {activeMenu === "account" ? (
        <Row gutter={[16, 16]} className="summary-grid">
          <Col xs={24} xl={14}>
            <Card id="sales-users" title="销售账号" loading={loading} extra={<Button type="primary" icon={<UserPlus size={16} />} onClick={openCreateAccount}>新增账号</Button>}>
              <Table<SalesUser>
                rowKey="id"
                dataSource={overview?.sales_users ?? []}
                pagination={false}
                columns={[
                  { title: "姓名", dataIndex: "name" },
                  { title: "账号", dataIndex: "email" },
                  { title: "角色", dataIndex: "role", render: (role: string) => roleOptions.find((item) => item.value === role)?.label ?? role },
                  { title: "负责范围", dataIndex: "data_scope" },
                  { title: "状态", dataIndex: "enabled", render: (enabled: boolean) => <Tag color={enabled ? "green" : "default"}>{enabled ? "启用" : "停用"}</Tag> },
                  { title: "操作", render: (_, user) => <Space><Button onClick={() => openEditAccount(user)}>编辑</Button><Switch checked={user.enabled} loading={savingAccount} onChange={(checked) => void toggleAccount(user, checked)} /></Space> }
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card id="permissions" title="角色权限矩阵" loading={loading} extra={<Button type="primary" icon={<ShieldCheck size={16} />} loading={savingPermission} onClick={() => void savePermissions()}>保存权限</Button>}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Select value={selectedRole} options={roleOptions} onChange={setSelectedRole} style={{ width: 220 }} />
                <Checkbox.Group value={permissionValues} onChange={(values) => setPermissionValues(values as string[])}>
                  <Space direction="vertical">{permissionOptions.map((item) => <Checkbox value={item.value} key={item.value}>{item.label}</Checkbox>)}</Space>
                </Checkbox.Group>
              </Space>
            </Card>
          </Col>
        </Row>
      ) : null}

      {activeMenu === "banner" ? (
        <Card id="banner" title="全局 Banner 管理" loading={loading}>
          <Row gutter={[24, 24]}>
            <Col xs={24} xl={10}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Alert type="info" showIcon message="Banner 图片建议" description="推荐尺寸 1920×360，支持 PNG/JPG/WebP；建议原图不超过 2MB。上传后会自动裁切压缩为横幅比例，避免发布失败。" />
                <Upload accept="image/png,image/jpeg,image/webp" maxCount={1} showUploadList={false} beforeUpload={async (file) => { try { const result = await readBannerImage(file); setBannerDraft((draft) => ({ ...draft, imageUrl: result.url })); setBannerImageMeta(result.meta); message.success("Banner 图片已载入预览，点击发布后同步到全部页面"); } catch (failure) { setError(asError(failure)); } return Upload.LIST_IGNORE; }}>
                  <Button icon={<ImageUp size={16} />}>上传 Banner 图片</Button>
                </Upload>
                {bannerImageMeta ? <Tag color="blue">原图 {bannerImageMeta.width}×{bannerImageMeta.height} · {formatFileSize(bannerImageMeta.originalSize)}，发布图 1920×360 · {formatFileSize(bannerImageMeta.compressedSize)}</Tag> : null}
                <Input value={bannerDraft.title} onChange={(event) => setBannerDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Banner 标题" />
                <Input.TextArea value={bannerDraft.body} onChange={(event) => setBannerDraft((draft) => ({ ...draft, body: event.target.value }))} placeholder="Banner 正文" rows={4} />
                <Button type="primary" icon={<Save size={16} />} loading={savingBanner} onClick={() => void publishBanner()}>发布到全部页面</Button>
              </Space>
            </Col>
            <Col xs={24} xl={14}>
              <div className="banner-preview" style={{ backgroundImage: `linear-gradient(105deg, rgba(17,24,39,.76), rgba(91,75,219,.72)), url(${bannerDraft.imageUrl})` }}>
                <strong>{bannerDraft.title}</strong><span>{bannerDraft.body}</span>
              </div>
            </Col>
          </Row>
        </Card>
      ) : null}

      {activeMenu === "routing" ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card title="国家区域销售映射" extra={<Link to="/admin/settings/country-sales"><Button>进入映射配置</Button></Link>}><Typography.Text className="muted">一个销售可以负责多个国家；客户导入时会按国家自动分配销售，你只需要确认异常结果。</Typography.Text></Card>
          <Card id="sources" title="客户来源字典" extra={<Space><Button icon={<Plus size={16} />} onClick={addSourceForSelectedCategory}>在当前类型新增来源</Button><Button type="primary" loading={savingRouting} onClick={() => void saveRouting("source")}>保存来源</Button></Space>}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert type="info" showIcon message="先选择来源类型，再维护该类型下的来源" description="默认不铺开全部来源。切换下拉菜单后，只编辑当前类型的来源项；保存后会同步影响线索池筛选和导入校验。" />
              <Row gutter={[16, 12]} align="middle">
                <Col xs={24} md={10}>
                  <Typography.Text className="field-label">来源类型下拉菜单</Typography.Text>
                  <Select
                    value={selectedSourceCategory}
                    options={sourceCategories.map((category) => ({
                      value: category,
                      label: `${category}（${sourceRows.filter((row) => (row.category || "未分组") === category).length} 个来源）`
                    }))}
                    onChange={setSelectedSourceCategory}
                    style={{ width: "100%" }}
                  />
                </Col>
                <Col xs={24} md={14}>
                  <Tag color="purple">当前类型：{selectedSourceCategory}</Tag>
                  <Tag color="blue">已展开 {selectedSourceRows.length} 个来源</Tag>
                </Col>
              </Row>
              <div className="source-dictionary-editor">
                {selectedSourceRows.map(({ row, index }) => (
                  <Row gutter={[12, 12]} align="middle" key={row.id ?? `new-source-${index}`} className="source-dictionary-row">
                    <Col xs={24} md={8}>
                      <Typography.Text className="field-label">来源类型</Typography.Text>
                      <Input value={row.category} onChange={(event) => updateSourceRow(index, { category: event.target.value })} />
                    </Col>
                    <Col xs={24} md={10}>
                      <Typography.Text className="field-label">来源名称</Typography.Text>
                      <Input value={row.label} onChange={(event) => updateSourceRow(index, { label: event.target.value })} placeholder="例如 官网聊天 / Facebook / 线下展会" />
                    </Col>
                    <Col xs={24} md={6}>
                      <Typography.Text className="field-label">是否启用</Typography.Text>
                      <Space><Switch checked={row.enabled} onChange={(enabled) => updateSourceRow(index, { enabled })} /><Typography.Text>{row.enabled ? "启用" : "停用"}</Typography.Text></Space>
                    </Col>
                  </Row>
                ))}
              </div>
            </Space>
          </Card>
          <Card id="channels" title="渠道配置" extra={<Space><Button icon={<Plus size={16} />} onClick={() => setChannelRows((rows) => [...rows, { key: `channel_${Date.now()}`, name: "", source_category: "网站", access_method: "Webhook", endpoint: "", enabled: true, status: "active" }])}>新增渠道</Button><Button type="primary" loading={savingRouting} onClick={() => void saveRouting("channel")}>保存渠道</Button></Space>}>
            <Table<ChannelConfig> rowKey="key" dataSource={channelRows} pagination={false} scroll={{ x: 1000 }} columns={[
              { title: "渠道 Key", width: 180, render: (_, row, index) => <Input value={row.key} onChange={(event) => updateChannelRow(index, { key: event.target.value })} /> },
              { title: "渠道名称", width: 180, render: (_, row, index) => <Input value={row.name} onChange={(event) => updateChannelRow(index, { name: event.target.value })} /> },
              { title: "来源类型", width: 160, render: (_, row, index) => <Input value={row.source_category} onChange={(event) => updateChannelRow(index, { source_category: event.target.value })} /> },
              { title: "接入方式", width: 160, render: (_, row, index) => <Input value={row.access_method} onChange={(event) => updateChannelRow(index, { access_method: event.target.value })} /> },
              { title: "接口/地址", width: 260, render: (_, row, index) => <Input value={row.endpoint} onChange={(event) => updateChannelRow(index, { endpoint: event.target.value })} /> },
              { title: "启用", width: 100, render: (_, row, index) => <Switch checked={row.enabled} onChange={(enabled) => updateChannelRow(index, { enabled })} /> }
            ]} />
          </Card>
          <Card id="reminders" title="提醒规则" extra={<Space><Button icon={<Plus size={16} />} onClick={() => setReminderRows((rows) => [...rows, { key: `reminder_${Date.now()}`, name: "", trigger_hours: 24, target: "销售负责人", channel: "邮件", enabled: true }])}>新增规则</Button><Button type="primary" loading={savingRouting} onClick={() => void saveRouting("reminder")}>保存规则</Button></Space>}>
            <Table<ReminderRule> rowKey="key" dataSource={reminderRows} pagination={false} scroll={{ x: 900 }} columns={[
              { title: "规则 Key", width: 180, render: (_, row, index) => <Input value={row.key} onChange={(event) => updateReminderRow(index, { key: event.target.value })} /> },
              { title: "规则名称", width: 220, render: (_, row, index) => <Input value={row.name} onChange={(event) => updateReminderRow(index, { name: event.target.value })} /> },
              { title: "触发小时", width: 120, render: (_, row, index) => <Input type="number" value={row.trigger_hours} onChange={(event) => updateReminderRow(index, { trigger_hours: Number(event.target.value || 1) })} /> },
              { title: "提醒对象", width: 180, render: (_, row, index) => <Input value={row.target} onChange={(event) => updateReminderRow(index, { target: event.target.value })} /> },
              { title: "提醒渠道", width: 160, render: (_, row, index) => <Input value={row.channel} onChange={(event) => updateReminderRow(index, { channel: event.target.value })} /> },
              { title: "启用", width: 100, render: (_, row, index) => <Switch checked={row.enabled} onChange={(enabled) => updateReminderRow(index, { enabled })} /> }
            ]} />
          </Card>
        </Space>
      ) : null}

      {activeMenu === "mail" ? (
        <Card id="mail" title="邮件接口配置" loading={loading}>
          <Row gutter={[24, 16]}>
            <Col xs={24} xl={10}><Alert type="info" showIcon message="发信邮箱用途" description="管理员和运营可使用全局主邮箱给潜在客户发邮件；销售也可以在“我的”里配置个人邮箱，用于给自己负责的客户发邮件。" /></Col>
            <Col xs={24} xl={14}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form layout="vertical" className="settings-inline-form">
                  <Form.Item label="发信邮箱"><Input prefix={<Mail size={16} />} value={mailDraft.senderEmail} onChange={(event) => setMailDraft((draft) => ({ ...draft, senderEmail: event.target.value }))} placeholder="例如 sales@company.com" /></Form.Item>
                  <Form.Item label="发件人名称"><Input value={mailDraft.senderName} onChange={(event) => setMailDraft((draft) => ({ ...draft, senderName: event.target.value }))} placeholder="例如 Ultrasound Growth Ops" /></Form.Item>
                  <Form.Item label="SMTP Host"><Input value={mailDraft.smtpHost} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpHost: event.target.value }))} placeholder="例如 smtp.office365.com" /></Form.Item>
                  <Form.Item label="SMTP Port"><Input type="number" value={mailDraft.smtpPort} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpPort: Number(event.target.value || 587) }))} placeholder="例如 587" /></Form.Item>
                  <Form.Item label="SMTP 用户名"><Input value={mailDraft.username} onChange={(event) => setMailDraft((draft) => ({ ...draft, username: event.target.value }))} placeholder="通常为邮箱账号或服务用户名" /></Form.Item>
                  <Form.Item label="SMTP 密码 / 应用专用密码"><Input.Password value={mailDraft.password} onChange={(event) => setMailDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="保存后不会明文回显" /></Form.Item>
                  <Form.Item label="测试收件人邮箱（可选）"><Input value={mailDraft.testSendTo} onChange={(event) => setMailDraft((draft) => ({ ...draft, testSendTo: event.target.value }))} placeholder="用于保存时发送测试邮件" /></Form.Item>
                </Form>
                <Space wrap><Switch checked={mailDraft.useTls} onChange={(useTls) => setMailDraft((draft) => ({ ...draft, useTls }))} /><Typography.Text>启用 TLS 加密连接</Typography.Text><Switch checked={mailDraft.enabled} onChange={(enabled) => setMailDraft((draft) => ({ ...draft, enabled }))} /><Typography.Text>启用全局主邮箱</Typography.Text></Space>
                <Button type="primary" icon={<Save size={16} />} loading={savingMail} onClick={() => void saveMailSettings()}>保存并测试配置</Button>
              </Space>
            </Col>
          </Row>
        </Card>
      ) : null}

      {activeMenu === "ai" ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card title="场景模型绑定" loading={loading} extra={<Space wrap><Button icon={<Plus size={16} />} onClick={openCreateUseCase}>添加模型场景</Button><Button danger icon={<Trash2 size={16} />} onClick={deleteSelectedUseCase}>删除所选场景</Button><Button type="primary" icon={<Save size={16} />} loading={savingAIModel} onClick={() => void saveAIModel()}>保存配置</Button></Space>}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <Typography.Text className="field-label">先选择模型场景</Typography.Text>
                <Select value={selectedUseCaseKey} options={aiModelUseCases.map((item) => ({ value: item.key, label: `${item.label} · ${item.key}` }))} onChange={setSelectedUseCaseKey} style={{ width: "100%" }} />
                {selectedUseCase ? <Alert type="info" showIcon className="login-error" message={selectedUseCase.label} description={selectedUseCase.description} /> : null}
              </Col>
              <Col xs={24} md={14}>
                <Typography.Text className="field-label">再为该场景选择大模型</Typography.Text>
                <Select value={selectedBindingValue} options={availableModelSelectOptions} onChange={(value) => selectedUseCase && setAIModelBindings((bindings) => ({ ...bindings, [selectedUseCase.key]: value }))} style={{ width: "100%" }} />
                <div className="config-detail-card">
                  <Tag color="purple">当前绑定：{selectedBindingModel?.label}</Tag>
                  <Tag color={selectedBindingModel?.api_key_configured ? "green" : "gold"}>{selectedBindingModel?.api_key_configured ? "API Key 已配置" : "API Key 未配置"}</Tag>
                  <Typography.Paragraph className="muted">{selectedBindingModel?.provider} · {selectedBindingModel?.scenario} · {selectedBindingModel?.capability}</Typography.Paragraph>
                </div>
              </Col>
            </Row>
          </Card>
          <Card title="大模型连接配置" loading={loading} extra={<Space wrap><Button icon={<Plus size={16} />} onClick={openCreateModel}>添加大模型</Button><Button onClick={() => { const index = modelOptions.findIndex((item) => item.value === selectedModelValue); if (index >= 0) openEditModel(index); }}>编辑所选模型</Button><Button danger icon={<Trash2 size={16} />} onClick={deleteSelectedModel}>删除所选模型</Button><Button type="primary" icon={<Save size={16} />} loading={savingAIModel} onClick={() => void saveAIModel()}>保存模型库</Button></Space>}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <Typography.Text className="field-label">模型库下拉菜单</Typography.Text>
                <Select value={selectedModelValue} options={modelSelectOptions} onChange={setSelectedModelValue} style={{ width: "100%" }} />
              </Col>
              <Col xs={24} md={14}>
                <div className="config-detail-card">
                  <Typography.Title level={5}>{selectedModelForDetails?.label} · {selectedModelForDetails?.provider}</Typography.Title>
                  <Space wrap>
                    <Tag color={selectedModelForDetails?.status === "available" ? "green" : "default"}>{selectedModelForDetails?.status === "available" ? "可用" : "停用"}</Tag>
                    <Tag color={selectedModelForDetails?.api_key_configured ? "green" : "gold"}>{selectedModelForDetails?.api_key_configured ? "API Key 已配置" : "API Key 未配置"}</Tag>
                    <Tag>{selectedModelForDetails?.auth_type || "bearer"}</Tag>
                    <Switch checked={selectedModelForDetails?.status !== "disabled"} onChange={toggleSelectedModel} />
                    <Typography.Text>{selectedModelForDetails?.status === "disabled" ? "已关闭" : "已开启"}</Typography.Text>
                  </Space>
                  <Typography.Paragraph className="muted">API：{selectedModelForDetails?.api_base_url || "未配置"}{selectedModelForDetails?.endpoint_path || ""}</Typography.Paragraph>
                  <Typography.Paragraph className="muted">能力：{selectedModelForDetails?.capability}</Typography.Paragraph>
                </div>
              </Col>
            </Row>
          </Card>
          <Card title="邮件写手角色" loading={loading} extra={<Space wrap><Button icon={<Plus size={16} />} onClick={openCreateWriter}>新增写手</Button><Button onClick={() => { const index = emailWriters.findIndex((writer) => writer.key === selectedWriterKey); if (index >= 0) openEditWriter(index); }}>编辑所选角色</Button><Button danger icon={<Trash2 size={16} />} onClick={deleteSelectedWriter}>删除所选角色</Button><Button type="primary" icon={<Save size={16} />} loading={savingAIModel} onClick={() => void saveAIModel()}>保存写手配置</Button></Space>}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Typography.Text className="field-label">默认邮件写手</Typography.Text>
                <Select value={defaultEmailWriter} options={enabledEmailWriters.map((writer) => ({ value: writer.key, label: `${writer.name} · ${writer.display_name}` }))} onChange={(value) => { setDefaultEmailWriter(value); setSelectedWriterKey(value); }} style={{ width: "100%" }} />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text className="field-label">角色下拉菜单</Typography.Text>
                <Select value={selectedWriterKey} options={emailWriters.map((writer) => ({ value: writer.key, label: `${writer.name} · ${writer.display_name}` }))} onChange={setSelectedWriterKey} style={{ width: "100%" }} />
              </Col>
              <Col xs={24} md={8}>
                <div className="config-detail-card compact">
                  <strong>{selectedWriterForDetails?.display_name} / {selectedWriterForDetails?.name}</strong>
                  <Typography.Paragraph className="muted">{selectedWriterForDetails?.style}</Typography.Paragraph>
                  <Space wrap>{selectedWriterForDetails?.skills.map((skill) => <Tag key={skill}>{skill}</Tag>)}</Space>
                </div>
              </Col>
            </Row>
          </Card>
          <Card title="产品与 AI 配置入口">
            <Row gutter={[16, 16]}>
              {knowledgeBaseLinks.map((item) => (
                <Col xs={24} md={8} key={item.key}>
                  <Link to={`/admin/settings/product-knowledge?knowledge_base=${item.key}`}>
                    <Card size="small" hoverable className="settings-entry-card">
                      <Typography.Text strong>{item.label}</Typography.Text>
                      <Typography.Paragraph className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{item.description}</Typography.Paragraph>
                    </Card>
                  </Link>
                </Col>
              ))}
              <Col xs={24}>
                <Link to="/admin/settings/product-knowledge">
                  <Button icon={<Plus size={16} />}>新增自定义知识库板块</Button>
                </Link>
              </Col>
            </Row>
          </Card>
        </Space>
      ) : null}

      {activeMenu === "audit" ? (
        <Card title="最近变更" loading={loading} extra={<Button icon={<RefreshCw size={16} />} onClick={() => void load()}>刷新</Button>}>
          <Table rowKey="id" dataSource={overview?.recent_changes ?? []} pagination={false} columns={[
            { title: "动作", dataIndex: "action" },
            { title: "说明", dataIndex: "detail" },
            { title: "Trace", dataIndex: "trace_id" },
            { title: "时间", dataIndex: "created_at", render: (value: string) => new Date(value).toLocaleString() }
          ]} />
        </Card>
      ) : null}

      <Modal title={editingAccount ? "编辑账号" : "新增账号"} open={accountModalOpen} onCancel={() => setAccountModalOpen(false)} footer={null} destroyOnClose>
        <Form form={accountForm} layout="vertical" onFinish={(values) => void submitAccount(values)}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true }, { type: "email" }]}><Input /></Form.Item>
          {!editingAccount ? <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item> : null}
          <Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={roleOptions} /></Form.Item>
          <Form.Item name="dataScope" label="负责范围" rules={[{ required: true }]}><Input placeholder="例如 all / Latam / Peru" /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={savingAccount}>保存账号</Button>
            {editingAccount ? <Button danger icon={<Trash2 size={16} />} loading={savingAccount} onClick={confirmDeleteAccount}>删除账号</Button> : null}
          </Space>
        </Form>
      </Modal>

      <Modal title="新增模型场景" open={useCaseModalOpen} onCancel={() => setUseCaseModalOpen(false)} footer={null} destroyOnClose>
        <Form form={useCaseForm} layout="vertical" onFinish={submitUseCase}>
          <Form.Item name="key" label="场景 Key" rules={[{ required: true, min: 2 }]}><Input placeholder="例如 pricing_followup" /></Form.Item>
          <Form.Item name="label" label="场景名称" rules={[{ required: true, min: 2 }]}><Input placeholder="例如 报价后跟进" /></Form.Item>
          <Form.Item name="description" label="场景说明" rules={[{ required: true, min: 4 }]}><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit">保存场景</Button>
        </Form>
      </Modal>

      <Modal title={editingModelIndex === null ? "添加大模型" : "编辑大模型"} open={modelModalOpen} onCancel={() => setModelModalOpen(false)} footer={null} destroyOnClose width={720}>
        <Form form={modelForm} layout="vertical" onFinish={submitModel}>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="value" label="模型 Key" rules={[{ required: true, min: 2 }]}><Input placeholder="例如 claude-sonnet-4" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="label" label="模型名称" rules={[{ required: true, min: 2 }]}><Input placeholder="例如 Claude Sonnet" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="provider" label="供应商" rules={[{ required: true, min: 2 }]}><Input placeholder="Anthropic / OpenAI / DeepSeek" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={[{ value: "available", label: "可用" }, { value: "disabled", label: "停用" }]} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="scenario" label="适用场景" rules={[{ required: true, min: 4 }]}><Input placeholder="例如 邮件草稿、客户背景调研" /></Form.Item></Col>
            <Col xs={24}><Form.Item name="capability" label="能力说明" rules={[{ required: true, min: 4 }]}><Input placeholder="例如 长文本写作、语气控制、多语言摘要" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="api_base_url" label="API Base URL"><Input placeholder="https://api.openai.com" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="endpoint_path" label="Endpoint Path"><Input placeholder="/v1/responses" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="auth_type" label="鉴权方式"><Select options={[{ value: "bearer", label: "Bearer Token" }, { value: "x-api-key", label: "x-api-key" }, { value: "custom", label: "自定义 Header" }]} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="apiKey" label="API Key / Token"><Input.Password placeholder="填写后只显示已配置，不明文回显" /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit">保存模型</Button>
        </Form>
      </Modal>

      <Modal title={editingWriterIndex === null ? "新增邮件写手" : "编辑邮件写手"} open={writerModalOpen} onCancel={() => setWriterModalOpen(false)} footer={null} destroyOnClose width={640}>
        <Form form={writerForm} layout="vertical" onFinish={submitWriter}>
          <Form.Item name="key" label="角色 Key" rules={[{ required: true, min: 2 }]}><Input placeholder="例如 baymax" /></Form.Item>
          <Form.Item name="name" label="英文角色" rules={[{ required: true, min: 2 }]}><Input placeholder="Baymax" /></Form.Item>
          <Form.Item name="display_name" label="中文名" rules={[{ required: true, min: 1 }]}><Input placeholder="大白" /></Form.Item>
          <Form.Item name="style" label="风格" rules={[{ required: true, min: 4 }]}><Input.TextArea rows={2} placeholder="稳重、专业、可靠" /></Form.Item>
          <Form.Item name="skillsText" label="技能（用顿号或换行分隔）" rules={[{ required: true, min: 2 }]}><Input.TextArea rows={3} placeholder="正式邮件、医疗客户、技术沟通" /></Form.Item>
          <Form.Item name="best_for" label="适用场景" rules={[{ required: true, min: 2 }]}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={[{ value: "enabled", label: "启用" }, { value: "disabled", label: "停用" }]} /></Form.Item>
          <Button type="primary" htmlType="submit">保存角色</Button>
        </Form>
      </Modal>
    </section>
  );
}
