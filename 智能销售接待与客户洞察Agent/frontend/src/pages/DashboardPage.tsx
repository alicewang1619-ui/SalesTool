import { Alert, Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { Check, Filter, RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchDashboard,
  fetchSalesUsers,
  fetchSourceDictionary,
  type DashboardFilters,
  type DashboardResult,
  type DashboardTodo,
  type SalesUser,
  type SourceOption
} from "../api";

const scoreColor: Record<string, string> = {
  有效: "green",
  高意向: "purple",
  待补充: "orange",
  资料库: "gold"
};

const pageSizeOptions = [5, 10, 20];

function uniq(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [optionSource, setOptionSource] = useState<DashboardTodo[]>([]);
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>({ page: 1, pageSize: 10, cycle: "all" });
  const [filters, setFilters] = useState<DashboardFilters>({ page: 1, pageSize: 10, cycle: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = (nextFilters = filters) => {
    setLoading(true);
    setError(null);
    fetchDashboard(nextFilters)
      .then((result) => {
        setDashboard(result);
        setError(null);
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard(filters);
  }, [filters]);

  useEffect(() => {
    fetchDashboard({ page: 1, pageSize: 50 })
      .then((result) => setOptionSource(result.items))
      .catch(() => setOptionSource([]));
    fetchSourceDictionary()
      .then(setSourceOptions)
      .catch(() => setSourceOptions([]));
    fetchSalesUsers()
      .then(setSalesUsers)
      .catch(() => setSalesUsers([]));
  }, []);

  const metrics = dashboard?.metrics;
  const countryOptions = uniq(optionSource.map((item) => item.country));
  const customerTypeOptions = uniq(optionSource.map((item) => item.customer_type));
  const productOptions = uniq(optionSource.map((item) => item.product));
  const sourceCategoryOptions = useMemo(
    () => uniq(sourceOptions.map((item) => item.category)).map((category) => ({ value: category, label: category })),
    [sourceOptions]
  );

  const updateDraft = (patch: DashboardFilters) => {
    setDraftFilters((current) => ({ ...current, ...patch, page: 1 }));
  };

  const applyFilters = () => {
    setFilters({ ...draftFilters, page: 1 });
  };

  const resetFilters = () => {
    const nextFilters: DashboardFilters = { page: 1, pageSize: filters.pageSize ?? 10, cycle: "all" };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
  };

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1 (MVP) · 工作台</Typography.Text>
          <Typography.Title level={2}>工作台首页</Typography.Title>
          <Typography.Paragraph className="muted">
            统一查看今日询盘、有效线索、未反馈和官网 KPI；筛选、分页和指标均由后端按当前账号权限计算。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => document.getElementById("dashboard-filters")?.scrollIntoView()}>
            筛选
          </Button>
          <Button type="primary" icon={<Check size={16} />} onClick={applyFilters}>
            确认
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert
          showIcon
          type="error"
          message="工作台数据加载失败"
          description={error}
          action={
            <Button icon={<RefreshCw size={16} />} onClick={() => loadDashboard(filters)}>
              重试
            </Button>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="今日询盘" value={metrics?.today_inquiries ?? 0} />
            <div className="metric-chip">按当前筛选实时归集</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="有效线索" value={metrics?.valid_leads ?? 0} />
            <div className="metric-chip green">后端评分与人工状态合并</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="未反馈" value={metrics?.unfeedback ?? 0} />
            <div className="metric-chip amber">需要继续跟进</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="官网 KPI" value={metrics?.website_kpi ?? 0} suffix="%" />
            <div className="metric-chip">按可归因来源计算</div>
          </Card>
        </Col>
      </Row>

      <Card id="dashboard-filters" className="dashboard-toolbar">
        <Space wrap size="middle">
          <Select
            allowClear
            aria-label="来源"
            placeholder="全部来源"
            value={draftFilters.sourceCategory}
            options={sourceCategoryOptions}
            onChange={(sourceCategory) => updateDraft({ sourceCategory })}
          />
          <Select
            allowClear
            aria-label="国家"
            placeholder="全部国家"
            value={draftFilters.country}
            options={countryOptions.map((country) => ({ value: country, label: country }))}
            onChange={(country) => updateDraft({ country })}
          />
          <Select
            allowClear
            aria-label="客户类型"
            placeholder="全部类型"
            value={draftFilters.customerType}
            options={customerTypeOptions.map((customerType) => ({ value: customerType, label: customerType }))}
            onChange={(customerType) => updateDraft({ customerType })}
          />
          <Select
            allowClear
            aria-label="产品"
            placeholder="全部产品"
            value={draftFilters.product}
            options={productOptions.map((product) => ({ value: product, label: product }))}
            onChange={(product) => updateDraft({ product })}
          />
          <Select
            allowClear
            aria-label="销售"
            placeholder="全部销售"
            value={draftFilters.ownerId}
            options={salesUsers.map((user) => ({ value: user.id, label: user.name }))}
            onChange={(ownerId) => updateDraft({ ownerId })}
          />
          <Select
            aria-label="周期"
            value={draftFilters.cycle ?? "all"}
            options={[
              { value: "all", label: "全部周期" },
              { value: "today", label: "今日" }
            ]}
            onChange={(cycle) => updateDraft({ cycle })}
          />
          <Button type="primary" icon={<Check size={16} />} onClick={applyFilters}>
            应用
          </Button>
          <Button onClick={resetFilters}>清空</Button>
          <Button icon={<RefreshCw size={16} />} onClick={() => loadDashboard(filters)}>
            刷新
          </Button>
          <Button type="primary" icon={<Upload size={16} />} onClick={() => navigate("/admin/leads?intent=import")}>
            导入线索
          </Button>
        </Space>
        <Typography.Text className="muted">
          当前显示：按后端筛选条件返回的 {dashboard?.total ?? 0} 条待办记录
        </Typography.Text>
      </Card>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="AI 摘要" loading={loading}>
            <Typography.Paragraph>{dashboard?.ai_summary}</Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="分发与反馈" loading={loading}>
            <div className="timeline-list">
              {dashboard?.assignment_timeline.map((item) => (
                <div className="timeline-item" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="table-card">
        <Table<DashboardTodo>
          rowKey="id"
          loading={loading}
          dataSource={dashboard?.items ?? []}
          scroll={{ x: 980 }}
          pagination={{
            current: dashboard?.page ?? filters.page ?? 1,
            pageSize: dashboard?.page_size ?? filters.pageSize ?? 10,
            total: dashboard?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: pageSizeOptions.map(String),
            onChange: (page, pageSize) => {
              const nextFilters = { ...filters, page, pageSize };
              setDraftFilters(nextFilters);
              setFilters(nextFilters);
            }
          }}
          columns={[
            { title: "客户", dataIndex: "customer_name" },
            { title: "国家", dataIndex: "country" },
            { title: "类型", dataIndex: "customer_type" },
            { title: "产品", dataIndex: "product" },
            {
              title: "来源",
              render: (_, record) => (
                <Space>
                  <Tag color="purple">{record.source_category}</Tag>
                  <span>{record.source_label}</span>
                </Space>
              )
            },
            {
              title: "评分",
              dataIndex: "score_label",
              render: (value: string) => <Tag color={scoreColor[value] ?? "default"}>{value}</Tag>
            },
            { title: "反馈", dataIndex: "feedback_status" },
            {
              title: "动作",
              render: (_, record) => (
                <Button onClick={() => navigate(record.detail_path)}>
                  查看详情
                </Button>
              )
            }
          ]}
        />
      </Card>
    </section>
  );
}
