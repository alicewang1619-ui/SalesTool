import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { Check, Download, Filter, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchReportPeriod, type ReportBreakdownItem, type ReportPeriod, type ReportPeriodViewResult } from "../api";

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "day", label: "日报" },
  { value: "month", label: "月报" },
  { value: "quarter", label: "季报" },
  { value: "year", label: "年报" }
];

type TraceableError = Error & { traceId?: string };

function asTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) return error as TraceableError;
  return new Error("报表数据加载失败");
}

function compactFilters(filters: {
  country: string;
  sourceCategory: string;
  product: string;
  feedbackStatus: string;
}) {
  return {
    country: filters.country.trim() || undefined,
    sourceCategory: filters.sourceCategory.trim() || undefined,
    product: filters.product.trim() || undefined,
    feedbackStatus: filters.feedbackStatus.trim() || undefined
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function BreakdownTable({ rows }: { rows: ReportBreakdownItem[] }) {
  return (
    <Table
      rowKey="label"
      size="middle"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: "维度", dataIndex: "label" },
        { title: "询盘", dataIndex: "inquiry_count" },
        { title: "有效", dataIndex: "valid_count" },
        { title: "有效率", dataIndex: "valid_rate", render: (value: number) => `${value}%` }
      ]}
    />
  );
}

export function ReportsPeriodPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriod = (searchParams.get("period") as ReportPeriod | null) ?? "day";
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [filters, setFilters] = useState({
    country: searchParams.get("country") ?? "",
    sourceCategory: searchParams.get("source_category") ?? "",
    product: searchParams.get("product") ?? "",
    feedbackStatus: searchParams.get("feedback_status") ?? ""
  });
  const [data, setData] = useState<ReportPeriodViewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TraceableError | null>(null);

  const appliedFilters = useMemo(() => compactFilters(filters), [filters]);

  async function load(nextPeriod = period) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReportPeriod({ period: nextPeriod, ...appliedFilters, page: 1, pageSize: 10 });
      setData(result);
      setPeriod(result.period);
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(initialPeriod);
  }, []);

  function applyFilters(showToast: boolean) {
    const params = new URLSearchParams({ period });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key === "sourceCategory" ? "source_category" : key === "feedbackStatus" ? "feedback_status" : key, value);
      }
    });
    setSearchParams(params);
    void load(period).then(() => {
      if (showToast) message.success("当前周期报表已确认");
    });
  }

  const metricCards = [
    { key: "inquiries", label: "询盘量", value: data?.metrics.inquiries ?? 0, hint: "当前周期进入系统的询盘" },
    { key: "valid", label: "有效量", value: data?.metrics.valid_leads ?? 0, hint: "有效与高意向线索" },
    { key: "unfeedback", label: "未反馈", value: data?.metrics.unfeedback ?? 0, hint: "仍未收到销售反馈" },
    { key: "website", label: "官网 KPI", value: data?.metrics.website_kpi ?? 0, unit: "%", hint: "官网来源占比" }
  ];

  return (
    <section className="reports-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 报表中心</Typography.Text>
          <Typography.Title level={2}>周期报表视图</Typography.Title>
          <Typography.Paragraph className="muted">
            按日/月/季度/年查看询盘量、有效量、国家、渠道、产品和销售反馈，并明确展示当前数据对应的时间段。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Select
            aria-label="报表周期"
            value={period}
            options={periodOptions}
            onChange={(value) => setPeriod(value)}
            style={{ width: 128 }}
          />
          <Button icon={<Filter size={16} />} onClick={() => applyFilters(false)}>
            筛选
          </Button>
          <Button type="primary" icon={<Check size={16} />} onClick={() => applyFilters(true)}>
            确认
          </Button>
        </Space>
      </div>

      <Card className="dashboard-toolbar">
        <Space wrap>
          <Input
            aria-label="国家"
            placeholder="国家"
            value={filters.country}
            onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))}
          />
          <Input
            aria-label="渠道"
            placeholder="渠道"
            value={filters.sourceCategory}
            onChange={(event) => setFilters((current) => ({ ...current, sourceCategory: event.target.value }))}
          />
          <Input
            aria-label="产品"
            placeholder="产品"
            value={filters.product}
            onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))}
          />
          <Input
            aria-label="销售反馈"
            placeholder="销售反馈"
            value={filters.feedbackStatus}
            onChange={(event) => setFilters((current) => ({ ...current, feedbackStatus: event.target.value }))}
          />
        </Space>
      </Card>

      {error ? (
        <Alert
          showIcon
          type="error"
          message="报表数据加载失败"
          description={
            <Space direction="vertical" size={2}>
              <span>{error.message}</span>
              <span>错误码：{error.name}</span>
              {error.traceId ? <span>trace id：{error.traceId}</span> : null}
            </Space>
          }
          action={
            <Button icon={<RefreshCw size={16} />} onClick={() => void load(period)}>
              重试
            </Button>
          }
        />
      ) : null}

      <div className="subtle-note page-context-note">
        <Typography.Text strong>{`当前报表周期：${data?.period_label ?? periodOptions.find((item) => item.value === period)?.label ?? period}`}</Typography.Text>
        <Typography.Text className="muted">{`统计粒度：${data?.period_granularity ?? "—"}；数据范围：${formatDate(data?.query_window.start_at)} 至 ${formatDate(data?.query_window.end_at)}`}</Typography.Text>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        {metricCards.map((metric) => (
          <Col xs={24} md={12} xl={6} key={metric.key}>
            <Card loading={loading}>
              <Statistic title={metric.label} value={metric.value} suffix={metric.unit} />
              <div className={metric.key === "valid" ? "metric-chip green" : metric.key === "unfeedback" ? "metric-chip amber" : "metric-chip"}>
                {metric.hint}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="渠道质量" loading={loading}>
            <BreakdownTable rows={data?.breakdowns.channels ?? []} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="国家分布" loading={loading}>
            <BreakdownTable rows={data?.breakdowns.countries ?? []} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="产品分类" loading={loading}>
            <BreakdownTable rows={data?.breakdowns.products ?? []} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="销售反馈" loading={loading}>
            <BreakdownTable rows={data?.breakdowns.feedback_statuses ?? []} />
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Space wrap>
          <Tag color="purple">{data?.period_label ?? period}</Tag>
          <Tag>{formatDate(data?.query_window.start_at)} - {formatDate(data?.query_window.end_at)}</Tag>
          <Link to={data?.downstream.metrics_path ?? `/admin/reports/metrics?period=${period}`}>
            <Button>查看指标明细</Button>
          </Link>
          <Link to={data?.downstream.export_path ?? `/admin/reports/export?period=${period}`}>
            <Button type="primary" icon={<Download size={16} />}>
              导出
            </Button>
          </Link>
          {data?.downstream.export_requires_confirmation ? <Tag color="purple">导出前二次确认</Tag> : null}
        </Space>
        <Typography.Text className="muted">
          当前显示 {data?.items.length ?? 0} / {data?.total ?? 0} 条。
        </Typography.Text>
      </Card>

      <Card title="周期明细" loading={loading}>
        <Table
          rowKey="id"
          dataSource={data?.items ?? []}
          pagination={false}
          columns={[
            { title: "客户", dataIndex: "customer_name" },
            { title: "国家", dataIndex: "country" },
            { title: "渠道", dataIndex: "source_category" },
            { title: "产品", dataIndex: "product" },
            { title: "评分", dataIndex: "score_label" },
            { title: "反馈", dataIndex: "feedback_status" },
            {
              title: "动作",
              dataIndex: "detail_path",
              render: (path: string) => <Link to={path}>查看详情</Link>
            }
          ]}
        />
      </Card>
    </section>
  );
}
