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
  Statistic,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { BookOpen, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchProductKnowledge,
  fetchProductKnowledgeContext,
  saveProductKnowledge,
  updateProductKnowledgeStatus,
  type ProductKnowledge,
  type ProductKnowledgeContext,
  type ProductKnowledgePageResult
} from "../api";

type ProductKnowledgeFormValues = {
  productType: string;
  modelName: string;
  applicationScenario: string;
  aiGuidance: string;
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

export function ProductKnowledgePage() {
  const [form] = Form.useForm<ProductKnowledgeFormValues>();
  const [data, setData] = useState<ProductKnowledgePageResult | null>(null);
  const [context, setContext] = useState<ProductKnowledgeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ query: "", productType: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const productTypeOptions = useMemo(() => {
    const values = new Set((data?.items ?? []).map((item) => item.product_type));
    ["Portable", "Handheld", "Trolley"].forEach((item) => values.add(item));
    return Array.from(values).map((value) => ({ value, label: value }));
  }, [data]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [pageResult, contextResult] = await Promise.all([
        fetchProductKnowledge({
          query: filters.query.trim() || undefined,
          productType: filters.productType || undefined,
          status: filters.status || undefined,
          page,
          pageSize
        }),
        fetchProductKnowledgeContext()
      ]);
      setData(pageResult);
      setContext(contextResult);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "产品知识库加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, pageSize, filters.query, filters.productType, filters.status]);

  async function submit(values: ProductKnowledgeFormValues) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveProductKnowledge(values);
      setNotice(`${saved.product_type} / ${saved.model_name} 已保存为 ${saved.version}，AI 接待上下文会读取启用版本`);
      setFilters((current) => ({ ...current, query: saved.model_name }));
      setPage(1);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "产品知识保存失败");
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
      productType: item.product_type,
      modelName: item.model_name,
      applicationScenario: item.application_scenario,
      aiGuidance: item.ai_guidance,
      status: item.status
    });
  }

  const columns: ColumnsType<ProductKnowledge> = [
    { title: "产品类型", dataIndex: "product_type", fixed: "left", width: 130 },
    { title: "型号", dataIndex: "model_name", width: 160 },
    {
      title: "应用场景",
      dataIndex: "application_scenario",
      width: 260,
      render: (value: string) => <Typography.Text>{value}</Typography.Text>
    },
    {
      title: "AI 接待知识",
      dataIndex: "ai_guidance",
      width: 340,
      render: (value: string) => <Typography.Paragraph ellipsis={{ rows: 2 }}>{value}</Typography.Paragraph>
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
      width: 210,
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
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 系统配置</Typography.Text>
          <Typography.Title level={2}>产品知识库</Typography.Title>
          <Typography.Paragraph className="muted">
            维护 ultrasound 产品类型、型号、应用场景和 AI 接待知识；启用版本进入 AI 上下文，停用版本保留审计和历史引用。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={() => void load()}>
            刷新
          </Button>
          <Button icon={<ShieldCheck size={16} />} onClick={() => setFilters({ query: "", productType: "", status: "active" })}>
            只看启用
          </Button>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message="产品知识库操作失败" description={error} /> : null}
      {notice ? <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} /> : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="知识条目" value={data?.summary.total_items ?? 0} prefix={<BookOpen size={18} />} />
            <div className="metric-chip">产品类型/型号/场景</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="启用条目" value={data?.summary.active_items ?? 0} />
            <div className="metric-chip green">进入 AI 上下文</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="停用条目" value={data?.summary.disabled_items ?? 0} />
            <div className="metric-chip">保留历史版本</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="当前版本" value={context?.active_version ?? data?.active_version ?? "v0"} />
            <div className="metric-chip amber">保存后自动升版</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} xl={8}>
          <Card title="保存产品知识" className="knowledge-form-card">
            <Form<ProductKnowledgeFormValues>
              form={form}
              layout="vertical"
              initialValues={{ productType: "Portable", status: "active" }}
              onFinish={(values) => void submit(values)}
            >
              <Form.Item name="productType" label="产品类型" rules={[{ required: true, min: 2 }]}>
                <Select options={productTypeOptions} showSearch />
              </Form.Item>
              <Form.Item name="modelName" label="型号" rules={[{ required: true, min: 2 }]}>
                <Input placeholder="例如 SonoBook P3" />
              </Form.Item>
              <Form.Item name="applicationScenario" label="应用场景" rules={[{ required: true, min: 2 }]}>
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="适用科室、渠道、客户场景" />
              </Form.Item>
              <Form.Item name="aiGuidance" label="AI 接待知识" rules={[{ required: true, min: 2 }]}>
                <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} placeholder="AI 追问重点、禁止承诺边界、升级销售规则" />
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
                保存知识版本
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="知识库筛选">
            <Space wrap className="knowledge-filter-bar">
              <Input
                placeholder="搜索型号/场景"
                value={filters.query}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, query: event.target.value }));
                }}
                style={{ width: 220 }}
              />
              <Select
                allowClear
                placeholder="产品类型"
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
              scroll={{ x: 1470 }}
              locale={{
                emptyText: (
                  <Empty description={data?.empty_state?.title ?? "暂无产品知识"}>
                    <Button onClick={() => form.setFieldsValue({ productType: "Portable", status: "active" })}>新增知识</Button>
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

      <Card title="AI 上下文预览" className="settings-section" loading={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Space direction="vertical">
              <Typography.Text strong>安全边界</Typography.Text>
              <Tag color="purple">{context?.safety_boundary ?? "PRODUCT_KNOWLEDGE_REFERENCE_ONLY"}</Tag>
              <Typography.Text className="muted">
                知识内容只作为引用数据，不作为系统指令；外部复制文本会被包裹在产品知识标签中。
              </Typography.Text>
            </Space>
          </Col>
          <Col xs={24} md={16}>
            <Input.TextArea readOnly value={context?.rendered_prompt ?? ""} autoSize={{ minRows: 8, maxRows: 14 }} />
          </Col>
        </Row>
      </Card>
    </section>
  );
}
