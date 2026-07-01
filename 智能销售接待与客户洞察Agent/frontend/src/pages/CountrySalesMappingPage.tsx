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
  Switch,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { AlertTriangle, ArrowLeft, RefreshCw, Route, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchCountrySalesMappings,
  saveCountrySalesMapping,
  type CountrySalesMapping,
  type CountrySalesMappingPageResult,
  type PendingAssignment
} from "../api";

type MappingFormValues = {
  country: string;
  region: string;
  salesUserId: number;
  active: boolean;
};

const reasonLabel: Record<string, string> = {
  COUNTRY_MISSING: "国家缺失",
  COUNTRY_MAPPING_MISSING: "国家销售映射缺失",
  ASSIGNEE_MISSING: "负责人缺失"
};

const riskLabel: Record<string, string> = {
  MAPPING_INACTIVE: "映射停用",
  SALES_USER_MISSING: "销售账号不存在",
  OWNER_NOT_SALES: "负责人不是销售",
  SALES_USER_DISABLED: "销售账号已停用",
  PENDING_LEADS_WAITING: "仍有待分配线索"
};

export function CountrySalesMappingPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<MappingFormValues>();
  const [searchParams] = useSearchParams();
  const pendingCountry = searchParams.get("pending_country") ?? "";
  const [data, setData] = useState<CountrySalesMappingPageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState({ country: pendingCountry, region: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const salesOptions = useMemo(
    () =>
      (data?.sales_users ?? [])
        .filter((user) => user.enabled && user.role === "sales")
        .map((user) => ({ value: user.id, label: `${user.name} · ${user.data_scope}` })),
    [data]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCountrySalesMappings({
        country: filters.country.trim() || undefined,
        region: filters.region.trim() || undefined,
        status: filters.status || undefined,
        page,
        pageSize
      });
      setData(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "国家映射加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, pageSize, filters.country, filters.region, filters.status]);

  useEffect(() => {
    if (pendingCountry) {
      form.setFieldsValue({ country: pendingCountry });
    }
  }, [form, pendingCountry]);

  async function submit(values: MappingFormValues) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saveCountrySalesMapping({
        country: values.country,
        region: values.region,
        salesUserId: values.salesUserId,
        active: values.active ?? true
      });
      setNotice(`${saved.country} 已保存到 ${saved.region}，待分配列表会使用该负责人建议`);
      setFilters((current) => ({ ...current, country: saved.country }));
      setPage(1);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "国家映射保存失败");
    } finally {
      setSaving(false);
    }
  }

  function editMapping(mapping: CountrySalesMapping) {
    form.setFieldsValue({
      country: mapping.country,
      region: mapping.region,
      salesUserId: mapping.sales_user_id,
      active: mapping.active
    });
  }

  const columns: ColumnsType<CountrySalesMapping> = [
    { title: "国家", dataIndex: "country", fixed: "left", width: 150 },
    { title: "区域", dataIndex: "region", width: 150 },
    {
      title: "销售负责人",
      width: 220,
      render: (_, mapping) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{mapping.sales_user_name}</Typography.Text>
          <Typography.Text className="muted">{mapping.sales_user_email}</Typography.Text>
          {mapping.sales_user_enabled ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>}
        </Space>
      )
    },
    { title: "待分配", dataIndex: "pending_count", width: 100 },
    {
      title: "状态",
      width: 100,
      render: (_, mapping) => (mapping.active ? <Tag color="green">生效</Tag> : <Tag>停用</Tag>)
    },
    {
      title: "风险",
      width: 260,
      render: (_, mapping) => (
        <Space wrap>
          {mapping.risk_reasons.length === 0 ? <Tag color="green">正常</Tag> : null}
          {mapping.risk_reasons.map((reason) => (
            <Tag key={reason} color={mapping.risk_level === "danger" ? "red" : "gold"}>
              {riskLabel[reason] ?? reason}
            </Tag>
          ))}
        </Space>
      )
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
      width: 110,
      render: (_, mapping) => <Button onClick={() => editMapping(mapping)}>编辑</Button>
    }
  ];

  const pendingColumns: ColumnsType<PendingAssignment> = [
    { title: "客户", dataIndex: "customer_name", width: 180 },
    { title: "国家", dataIndex: "country", width: 120 },
    {
      title: "待处理原因",
      dataIndex: "pending_reasons",
      render: (reasons: string[]) => (
        <Space wrap>
          {reasons.map((reason) => (
            <Tag key={reason} color={reason === "COUNTRY_MAPPING_MISSING" ? "orange" : "purple"}>
              {reasonLabel[reason] ?? reason}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: "建议负责人",
      width: 160,
      render: (_, lead) => lead.suggested_owner_name ?? <Typography.Text className="muted">待配置</Typography.Text>
    },
    {
      title: "动作",
      width: 160,
      render: (_, lead) => <Link to={lead.detail_path}>查看线索详情</Link>
    }
  ];

  return (
    <section className="country-mapping-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 系统配置</Typography.Text>
          <Typography.Title level={2}>国家区域销售映射</Typography.Title>
          <Typography.Paragraph className="muted">
            维护国家、区域和销售负责人的确定性分发规则；已有线索不会被静默重分发，待分配列表会展示建议负责人供人工确认。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/admin/settings?section=country-sales")}>
            返回设置中心
          </Button>
          <Button icon={<RefreshCw size={16} />} onClick={() => void load()}>
            刷新
          </Button>
          <Button icon={<Route size={16} />} href="/admin/assignments/pending">
            待分配列表
          </Button>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message="国家映射操作失败" description={error} /> : null}
      {notice ? <Alert type="success" showIcon message={notice} closable onClose={() => setNotice(null)} /> : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="生效映射" value={data?.summary.active_mappings ?? 0} />
            <div className="metric-chip green">用于自动分发建议</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="缺映射线索" value={data?.summary.pending_without_mapping ?? 0} />
            <div className="metric-chip amber">进入待分配队列</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="风险规则" value={data?.summary.risk_mappings ?? 0} prefix={<AlertTriangle size={18} />} />
            <div className="metric-chip amber">需管理员复核</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="可用销售" value={data?.summary.enabled_sales_users ?? 0} />
            <div className="metric-chip">只允许选择启用账号</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} xl={8}>
          <Card title="保存映射" className="mapping-form-card">
            <Form<MappingFormValues>
              form={form}
              layout="vertical"
              initialValues={{ country: pendingCountry, region: "Latam", active: true }}
              onFinish={(values) => void submit(values)}
            >
              <Form.Item name="country" label="国家" rules={[{ required: true, min: 2 }]}>
                <Input placeholder="例如 Mexico" />
              </Form.Item>
              <Form.Item name="region" label="区域" rules={[{ required: true, min: 2 }]}>
                <Input placeholder="例如 Latam / Middle East" />
              </Form.Item>
              <Form.Item name="salesUserId" label="销售负责人" rules={[{ required: true }]}>
                <Select placeholder="选择启用销售账号" options={salesOptions} />
              </Form.Item>
              <Form.Item name="active" label="是否生效" valuePropName="checked">
                <Switch checkedChildren="生效" unCheckedChildren="停用" />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={saving} block>
                保存映射规则
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="映射筛选">
            <Space wrap className="mapping-filter-bar">
              <Input
                placeholder="按国家搜索"
                value={filters.country}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, country: event.target.value }));
                }}
                style={{ width: 180 }}
              />
              <Input
                placeholder="按区域搜索"
                value={filters.region}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, region: event.target.value }));
                }}
                style={{ width: 180 }}
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
                  { value: "active", label: "生效" },
                  { value: "inactive", label: "停用" },
                  { value: "risk", label: "有风险" }
                ]}
                style={{ width: 140 }}
              />
            </Space>
            <Table<CountrySalesMapping>
              rowKey="id"
              loading={loading}
              dataSource={data?.items ?? []}
              columns={columns}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: (
                  <Empty description={data?.empty_state?.title ?? "暂无映射规则"}>
                    <Button onClick={() => form.setFieldsValue({ country: filters.country || pendingCountry })}>新增映射</Button>
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

      <Card title="待分配预览" className="settings-section">
        <Table<PendingAssignment>
          rowKey="id"
          loading={loading}
          dataSource={data?.pending_items ?? []}
          columns={pendingColumns}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="暂无待分配线索" /> }}
        />
      </Card>
    </section>
  );
}
