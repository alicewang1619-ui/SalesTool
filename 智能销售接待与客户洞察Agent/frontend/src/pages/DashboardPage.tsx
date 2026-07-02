import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Typography } from "antd";
import { Check, RefreshCw, Upload } from "lucide-react";
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

const timeScopeOptions: Array<{ value: NonNullable<DashboardFilters["cycle"]>; label: string }> = [
  { value: "all", label: "全部历史" },
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨天" },
  { value: "date", label: "指定日期" }
];

function uniq(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function appendDateIfNeeded(path: string, filters: DashboardFilters): string {
  if (filters.cycle !== "date" || !filters.date) return path;
  const [base, rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("time_scope", "date");
  params.set("date", filters.date);
  return `${base}?${params.toString()}`;
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
  const timeScope = dashboard?.time_scope;
  const timeScopeLabel = timeScope?.label ?? "全部历史";
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

  const goMetric = (key: string, fallback: string) => {
    navigate(appendDateIfNeeded(dashboard?.metric_links?.[key] ?? fallback, filters));
  };

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 工作台</Typography.Text>
          <Typography.Title level={2}>工作台首页</Typography.Title>
          <Typography.Paragraph className="muted">
            统一查看总询盘、今日询盘、有效线索和待跟进任务；明细请从指标卡或快捷入口进入专门列表页。
          </Typography.Paragraph>
        </div>
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

      <Alert
        showIcon
        type="info"
        className="login-error"
        message={`当前时间范围：${timeScopeLabel}`}
        description={timeScope?.start_at ? `${formatDate(timeScope.start_at)} 至 ${formatDate(timeScope.end_at)}` : "展示当前权限范围内的全部历史询盘。"}
      />

      <Card id="dashboard-filters" className="dashboard-toolbar">
        <Space wrap size="middle">
          <Select
            aria-label="时间范围"
            value={draftFilters.cycle ?? "all"}
            options={timeScopeOptions}
            onChange={(cycle) => updateDraft({ cycle, date: cycle === "date" ? draftFilters.date : undefined })}
            style={{ width: 140 }}
          />
          {draftFilters.cycle === "date" ? (
            <Input aria-label="指定日期" type="date" value={draftFilters.date} onChange={(event) => updateDraft({ date: event.target.value })} style={{ width: 160 }} />
          ) : null}
          <Select
            allowClear
            aria-label="来源"
            placeholder="全部来源"
            value={draftFilters.sourceCategory}
            options={sourceCategoryOptions}
            onChange={(sourceCategory) => updateDraft({ sourceCategory })}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            aria-label="国家"
            placeholder="全部国家"
            value={draftFilters.country}
            options={countryOptions.map((country) => ({ value: country, label: country }))}
            onChange={(country) => updateDraft({ country })}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            aria-label="客户类型"
            placeholder="全部类型"
            value={draftFilters.customerType}
            options={customerTypeOptions.map((customerType) => ({ value: customerType, label: customerType }))}
            onChange={(customerType) => updateDraft({ customerType })}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            aria-label="产品"
            placeholder="全部产品"
            value={draftFilters.product}
            options={productOptions.map((product) => ({ value: product, label: product }))}
            onChange={(product) => updateDraft({ product })}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            aria-label="销售"
            placeholder="全部销售"
            value={draftFilters.ownerId}
            options={salesUsers.map((user) => ({ value: user.id, label: user.name }))}
            onChange={(ownerId) => updateDraft({ ownerId })}
            style={{ width: 160 }}
          />
          <Button type="primary" icon={<Check size={16} />} onClick={applyFilters}>
            应用筛选
          </Button>
          <Button onClick={resetFilters}>清空</Button>
          <Button icon={<RefreshCw size={16} />} onClick={() => loadDashboard(filters)}>
            刷新
          </Button>
          <Button type="primary" icon={<Upload size={16} />} onClick={() => navigate("/admin/leads/import")}>
            导入线索
          </Button>
        </Space>
        <Typography.Text className="muted">当前显示：{timeScopeLabel}，共 {dashboard?.total ?? 0} 条线索记录。</Typography.Text>
      </Card>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading} hoverable onClick={() => goMetric("total_inquiries", "/admin/leads?time_scope=all")}>
            <Statistic title="总询盘" value={dashboard?.total ?? 0} />
            <div className="metric-chip">点击查看当前筛选下全部线索</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading} hoverable onClick={() => goMetric("today_inquiries", "/admin/leads?time_scope=today")}>
            <Statistic title="今日询盘" value={metrics?.today_inquiries ?? 0} />
            <div className="metric-chip">自动跳转今日明细</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading} hoverable onClick={() => goMetric("valid_leads", "/admin/leads?score=valid")}>
            <Statistic title="有效线索" value={metrics?.valid_leads ?? 0} />
            <div className="metric-chip green">点击查看有效线索列表</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading} hoverable onClick={() => goMetric("unfeedback", "/admin/assignments/pending")}>
            <Statistic title="待跟进" value={metrics?.unfeedback ?? 0} />
            <div className="metric-chip amber">待分配 / 待反馈任务</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="AI 摘要" loading={loading}>
            <Typography.Paragraph>{dashboard?.ai_summary}</Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="分发与反馈" loading={loading}>
            <div className="timeline-list">
              {(dashboard?.assignment_timeline ?? []).map((item) => (
                <div className="timeline-item" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="table-card" title="继续处理">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card size="small" hoverable onClick={() => goMetric("total_inquiries", "/admin/leads?time_scope=all")}>
              <Typography.Text strong>进入线索池</Typography.Text>
              <Typography.Paragraph className="muted" style={{ marginBottom: 0, marginTop: 8 }}>查看当前筛选下的全部线索明细。</Typography.Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card size="small" hoverable onClick={() => navigate("/admin/customers")}>
              <Typography.Text strong>进入客户池</Typography.Text>
              <Typography.Paragraph className="muted" style={{ marginBottom: 0, marginTop: 8 }}>按客户维度查看资料和历史跟进。</Typography.Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card size="small" hoverable onClick={() => goMetric("unfeedback", "/admin/assignments/pending")}>
              <Typography.Text strong>处理待分配</Typography.Text>
              <Typography.Paragraph className="muted" style={{ marginBottom: 0, marginTop: 8 }}>把未分配线索交给对应销售。</Typography.Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card size="small" hoverable onClick={() => navigate("/admin/nurture")}>
              <Typography.Text strong>再营销邮件</Typography.Text>
              <Typography.Paragraph className="muted" style={{ marginBottom: 0, marginTop: 8 }}>继续编辑待确认邮件草稿。</Typography.Paragraph>
            </Card>
          </Col>
        </Row>
      </Card>
    </section>
  );
}
