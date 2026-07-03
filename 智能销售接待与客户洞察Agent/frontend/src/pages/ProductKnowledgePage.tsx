import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message
} from "antd";
import type { UploadProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeft, FileText, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  deleteProductKnowledgeBase,
  fetchProductKnowledge,
  saveProductKnowledge,
  saveProductKnowledgeBase,
  updateProductKnowledgeStatus,
  uploadProductKnowledgeSource,
  type ProductKnowledge,
  type ProductKnowledgePageResult
} from "../api";

type ProductKnowledgeFormValues = {
  knowledgeBase: string;
  productType: string;
  modelName: string;
  applicationScenario: string;
  aiGuidance: string;
  tags: string[];
  status: string;
};

const statusColor: Record<string, string> = {
  active: "green",
  draft: "gold",
  disabled: "default"
};

const statusLabel: Record<string, string> = {
  active: "启用",
  draft: "草稿",
  disabled: "停用"
};

const defaultKnowledgeBases = [
  { value: "product", label: "产品知识" },
  { value: "competitor", label: "竞品知识" },
  { value: "market", label: "市场知识" },
  { value: "commercial", label: "商务成果" }
];

const defaultKnowledgeBaseKeys = new Set(defaultKnowledgeBases.map((item) => item.value));

const baseTypePreset: Record<string, string> = {
  product: "本公司产品",
  competitor: "竞品信息",
  market: "市场资料",
  commercial: "商务成果"
};

const baseColor: Record<string, string> = {
  product: "purple",
  competitor: "red",
  market: "blue",
  commercial: "gold"
};

function knowledgeBaseLabel(value: string) {
  return defaultKnowledgeBases.find((item) => item.value === value)?.label ?? value;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function isSupportedKnowledgeFile(filename: string) {
  const lower = filename.toLowerCase();
  return [".pdf", ".doc", ".docx", ".txt", ".md"].some((suffix) => lower.endsWith(suffix));
}

function fileTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function uniqueTags(tags: string[]) {
  const result: string[] = [];
  tags.forEach((tag) => {
    const normalized = tag.trim();
    if (!normalized) return;
    if (!result.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      result.push(normalized.slice(0, 40));
    }
  });
  return result.slice(0, 12);
}

export function ProductKnowledgePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<ProductKnowledgeFormValues>();
  const [data, setData] = useState<ProductKnowledgePageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceFileLabel, setSourceFileLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    query: "",
    knowledgeBase: searchParams.get("knowledge_base") ?? "",
    productType: "",
    status: ""
  });
  const [selectedBaseKey, setSelectedBaseKey] = useState(searchParams.get("knowledge_base") ?? "product");
  const [baseDraft, setBaseDraft] = useState(searchParams.get("knowledge_base") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const isSelectedDefaultBase = defaultKnowledgeBaseKeys.has(selectedBaseKey);
  const openedFromSettings = location.pathname.startsWith("/admin/settings");

  const productTypeOptions = useMemo(() => {
    const values = new Set((data?.items ?? []).map((item) => item.product_type));
    ["本公司产品", "竞品信息", "市场资料", "商务成果", "活动资料", "Portable", "Handheld", "Trolley"].forEach((item) =>
      values.add(item)
    );
    return Array.from(values).map((value) => ({ value, label: value }));
  }, [data]);

  const knowledgeBaseOptions = useMemo(() => {
    const values = new Set([...(data?.knowledge_bases ?? []), ...defaultKnowledgeBases.map((item) => item.value)]);
    return Array.from(values).map((value) => ({ value, label: knowledgeBaseLabel(value) }));
  }, [data]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const pageResult = await fetchProductKnowledge({
        query: filters.query.trim() || undefined,
        knowledgeBase: filters.knowledgeBase || undefined,
        productType: filters.productType || undefined,
        status: filters.status || undefined,
        page,
        pageSize
      });
      setData(pageResult);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "知识库加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, pageSize, filters.query, filters.knowledgeBase, filters.productType, filters.status]);

  async function submit(values: ProductKnowledgeFormValues) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveProductKnowledge({
        ...values,
        tags: uniqueTags(values.tags ?? [])
      });
      setNotice(`${knowledgeBaseLabel(saved.knowledge_base)} · ${saved.model_name} 已保存，写邮件时可作为大模型知识上下文`);
      setFilters((current) => ({ ...current, query: saved.model_name }));
      setPage(1);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "知识保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: ProductKnowledge, status: string) {
    setError(null);
    setNotice(null);
    try {
      const updated = await updateProductKnowledgeStatus(item.id, status);
      setNotice(`${updated.model_name} 已切换为${statusLabel[updated.status] ?? updated.status}`);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "状态更新失败");
    }
  }

  function edit(item: ProductKnowledge) {
    form.setFieldsValue({
      knowledgeBase: item.knowledge_base,
      productType: item.product_type,
      modelName: item.model_name,
      applicationScenario: item.application_scenario,
      aiGuidance: item.ai_guidance,
      tags: item.tags ?? [],
      status: item.status
    });
    setSelectedBaseKey(item.knowledge_base);
    setBaseDraft(defaultKnowledgeBaseKeys.has(item.knowledge_base) ? "" : item.knowledge_base);
    setSourceFileLabel(null);
  }

  async function addKnowledgeBaseCategory() {
    const nextKey = baseDraft.trim();
    if (!nextKey) {
      setError("请输入要新增的知识库板块名称");
      return;
    }
    setError(null);
    setNotice(null);
    const bases = await saveProductKnowledgeBase({ nextKey });
    setData((current) => (current ? { ...current, knowledge_bases: bases } : current));
    setSelectedBaseKey(nextKey);
    form.setFieldsValue({ knowledgeBase: nextKey });
    setBaseDraft("");
    setNotice(`${knowledgeBaseLabel(nextKey)} 已加入知识库板块`);
  }

  async function renameKnowledgeBaseCategory() {
    const nextKey = baseDraft.trim();
    if (!selectedBaseKey || !nextKey) {
      setError("请选择要重命名的自定义知识库，并填写新名称");
      return;
    }
    if (isSelectedDefaultBase) {
      setError("默认知识库板块不支持重命名，可新增自定义知识库");
      return;
    }
    setError(null);
    setNotice(null);
    const bases = await saveProductKnowledgeBase({ currentKey: selectedBaseKey, nextKey });
    setData((current) => (current ? { ...current, knowledge_bases: bases } : current));
    setSelectedBaseKey(nextKey);
    form.setFieldsValue({ knowledgeBase: nextKey });
    setBaseDraft(nextKey);
    setNotice(`${selectedBaseKey} 已重命名为 ${nextKey}`);
    await load();
  }

  async function removeKnowledgeBaseCategory() {
    if (!selectedBaseKey) {
      setError("请选择要删除的自定义知识库");
      return;
    }
    if (isSelectedDefaultBase) {
      setError("默认知识库板块不能删除");
      return;
    }
    setError(null);
    setNotice(null);
    const bases = await deleteProductKnowledgeBase(selectedBaseKey);
    setData((current) => (current ? { ...current, knowledge_bases: bases } : current));
    setFilters((current) => ({ ...current, knowledgeBase: current.knowledgeBase === selectedBaseKey ? "" : current.knowledgeBase }));
    setSelectedBaseKey("product");
    form.setFieldsValue({ knowledgeBase: "product", productType: baseTypePreset.product });
    setBaseDraft("");
    setNotice(`${selectedBaseKey} 已删除`);
    await load();
  }

  const uploadProps: UploadProps = {
    accept: ".pdf,.doc,.docx,.txt,.md",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!isSupportedKnowledgeFile(file.name)) {
        setError("知识库资料支持 PDF / Word / TXT / Markdown，请不要上传图片或压缩包。");
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      setError(null);
      setNotice(null);
      try {
        const uploaded = await uploadProductKnowledgeSource(file);
        const currentGuidance = (form.getFieldValue("aiGuidance") ?? "").trim();
        const extractedBlock = `【资料文件：${uploaded.filename}】\n${uploaded.extracted_text}`;
        const nextGuidance = (currentGuidance ? `${currentGuidance}\n\n${extractedBlock}` : extractedBlock).slice(0, 3900);
        const currentTags = form.getFieldValue("tags") ?? [];
        const currentBase = form.getFieldValue("knowledgeBase") || selectedBaseKey || "product";
        form.setFieldsValue({
          knowledgeBase: currentBase,
          productType: form.getFieldValue("productType") || baseTypePreset[currentBase] || "自定义资料",
          modelName: form.getFieldValue("modelName") || fileTitle(uploaded.filename),
          applicationScenario: form.getFieldValue("applicationScenario") || `由资料文件导入：${uploaded.filename}`,
          aiGuidance: nextGuidance,
          tags: uniqueTags([...currentTags, ...uploaded.suggested_tags]),
          status: form.getFieldValue("status") || "active"
        });
        setSourceFileLabel(`${uploaded.filename} · ${formatFileSize(uploaded.size)} · 已读取正文，可编辑后保存`);
        message.success("资料已解析到知识内容，请确认分类和标签后保存");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "资料上传解析失败");
      } finally {
        setUploading(false);
      }
      return Upload.LIST_IGNORE;
    }
  };

  const columns: ColumnsType<ProductKnowledge> = [
    {
      title: "知识库",
      dataIndex: "knowledge_base",
      fixed: "left",
      width: 130,
      render: (value: string) => <Tag color={baseColor[value] ?? "purple"}>{knowledgeBaseLabel(value)}</Tag>
    },
    { title: "知识类型", dataIndex: "product_type", width: 140 },
    { title: "主题 / 对象", dataIndex: "model_name", width: 180 },
    {
      title: "内容与标签",
      dataIndex: "ai_guidance",
      width: 520,
      render: (_, item) => (
        <Space direction="vertical" size={6} className="knowledge-content-cell">
          <Typography.Text strong>{item.application_scenario}</Typography.Text>
          <Typography.Paragraph ellipsis={{ rows: 2 }}>{item.ai_guidance}</Typography.Paragraph>
          <Space wrap size={[4, 4]}>
            {(item.tags ?? []).length > 0 ? (
              item.tags.map((tag) => <Tag key={`${item.id}-${tag}`}>{tag}</Tag>)
            ) : (
              <Tag color="default">暂无关键词</Tag>
            )}
          </Space>
        </Space>
      )
    },
    { title: "版本", dataIndex: "version", width: 90 },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: string) => <Tag color={statusColor[value] ?? "default"}>{statusLabel[value] ?? value}</Tag>
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString()
    },
    {
      title: "操作",
      fixed: "right",
      width: 190,
      render: (_, item) => (
        <Space wrap>
          <Button onClick={() => edit(item)}>编辑</Button>
          {item.status === "disabled" ? (
            <Button onClick={() => void changeStatus(item, "active")}>启用</Button>
          ) : (
            <Button onClick={() => void changeStatus(item, "disabled")}>停用</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <section className="product-knowledge-page">
      {openedFromSettings ? (
        <div className="subpage-toolbar">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/admin/settings")}>
            返回配置中心
          </Button>
        </div>
      ) : null}

      {error ? <Alert type="error" showIcon message="知识库操作失败" description={error} /> : null}
      {notice ? <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} /> : null}

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} xl={8}>
          <Card title="新增 / 编辑知识" className="knowledge-form-card">
            <Form<ProductKnowledgeFormValues>
              form={form}
              layout="vertical"
              initialValues={{
                knowledgeBase: searchParams.get("knowledge_base") ?? "product",
                productType: baseTypePreset[searchParams.get("knowledge_base") ?? "product"],
                tags: [],
                status: "active"
              }}
              onFinish={(values) => void submit(values)}
            >
              <Form.Item name="knowledgeBase" label="所属知识库" rules={[{ required: true, min: 2 }]}>
                <Select
                  showSearch
                  options={knowledgeBaseOptions}
                  onChange={(value) => {
                    setSelectedBaseKey(value);
                    form.setFieldsValue({ productType: form.getFieldValue("productType") || baseTypePreset[value] || "自定义资料" });
                  }}
                />
              </Form.Item>
              <Form.Item name="productType" label="知识类型" rules={[{ required: true, min: 2 }]}>
                <Select options={productTypeOptions} showSearch />
              </Form.Item>
              <Form.Item name="modelName" label="主题 / 对象" rules={[{ required: true, min: 2 }]}>
                <Input placeholder="例如 SonoBook P3 / 竞品型号 / 某次活动 / 商务案例" />
              </Form.Item>
              <Form.Item name="applicationScenario" label="适用场景" rules={[{ required: true, min: 2 }]}>
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="说明这条知识适合在哪些客户、邮件目的或销售场景中使用" />
              </Form.Item>
              <Form.Item name="aiGuidance" label="知识内容" rules={[{ required: true, min: 2 }]}>
                <Input.TextArea autoSize={{ minRows: 6, maxRows: 10 }} placeholder="可手动输入，也可上传 PDF / Word 后自动读取正文" />
              </Form.Item>
              <Form.Item name="tags" label="关键词标签">
                <Select mode="tags" tokenSeparators={[",", "，", ";", "；"]} placeholder="输入关键词后回车，如 Portable、竞品、医院、活动" />
              </Form.Item>
              <Form.Item label="资料上传">
                <Upload {...uploadProps}>
                  <Button icon={<UploadCloud size={16} />} loading={uploading}>
                    上传 PDF / Word / TXT
                  </Button>
                </Upload>
                <div className="knowledge-upload-note">
                  <FileText size={14} />
                  <span>{sourceFileLabel ?? "上传后会读取正文并填入“知识内容”，同时建议关键词标签；保存后才进入知识库。"}</span>
                </div>
              </Form.Item>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "active", label: "启用" },
                    { value: "draft", label: "草稿" },
                    { value: "disabled", label: "停用" }
                  ]}
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={saving} block>
                保存知识
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card title="知识库内容" className="knowledge-list-card">
            <Space wrap className="knowledge-filter-bar">
              <Select
                placeholder="选择板块"
                value={selectedBaseKey}
                onChange={(value) => {
                  setSelectedBaseKey(value);
                  setBaseDraft(defaultKnowledgeBaseKeys.has(value) ? "" : value);
                  form.setFieldsValue({ knowledgeBase: value, productType: form.getFieldValue("productType") || baseTypePreset[value] || "自定义资料" });
                }}
                options={knowledgeBaseOptions}
                style={{ width: 180 }}
              />
              <Input
                placeholder="新增自定义板块，如 distributor_playbook"
                value={baseDraft}
                onChange={(event) => setBaseDraft(event.target.value)}
                style={{ width: 260 }}
              />
              <Button icon={<Plus size={16} />} onClick={() => void addKnowledgeBaseCategory()}>
                新增板块
              </Button>
              <Button disabled={isSelectedDefaultBase} onClick={() => void renameKnowledgeBaseCategory()}>
                重命名
              </Button>
              <Button danger disabled={isSelectedDefaultBase} icon={<Trash2 size={16} />} onClick={() => void removeKnowledgeBaseCategory()}>
                删除
              </Button>
            </Space>

            <Space wrap className="knowledge-filter-bar">
              <Input
                placeholder="搜索主题 / 标签 / 场景"
                value={filters.query}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, query: event.target.value }));
                }}
                style={{ width: 220 }}
              />
              <Select
                allowClear
                placeholder="知识库分类"
                value={filters.knowledgeBase || undefined}
                onChange={(value) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, knowledgeBase: value ?? "" }));
                }}
                options={knowledgeBaseOptions}
                style={{ width: 170 }}
              />
              <Select
                allowClear
                placeholder="知识类型"
                value={filters.productType || undefined}
                onChange={(value) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, productType: value ?? "" }));
                }}
                options={productTypeOptions}
                style={{ width: 160 }}
              />
              <Select
                allowClear
                placeholder="状态"
                value={filters.status || undefined}
                onChange={(value) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, status: value ?? "" }));
                }}
                options={[
                  { value: "active", label: "启用" },
                  { value: "draft", label: "草稿" },
                  { value: "disabled", label: "停用" }
                ]}
                style={{ width: 140 }}
              />
            </Space>

            <Table<ProductKnowledge>
              rowKey="id"
              loading={loading}
              dataSource={data?.items ?? []}
              columns={columns}
              scroll={{ x: 1410 }}
              locale={{
                emptyText: (
                  <Empty description={data?.empty_state?.title ?? "暂无知识条目"}>
                    <Button
                      onClick={() =>
                        form.setFieldsValue({
                          knowledgeBase: selectedBaseKey || "product",
                          productType: baseTypePreset[selectedBaseKey] || "自定义资料",
                          tags: [],
                          status: "active"
                        })
                      }
                    >
                      新增知识
                    </Button>
                  </Empty>
                )
              }}
              pagination={{
                current: page,
                pageSize,
                total: data?.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50"],
                onChange: (nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize);
                }
              }}
            />
          </Card>
        </Col>
      </Row>
    </section>
  );
}
