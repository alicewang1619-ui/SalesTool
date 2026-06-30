import { Alert, Button, Card, Col, Empty, Input, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { Check, Download, Filter, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchReportMetricsDetail,
  type ReportMetricDetailItem,
  type ReportMetricsDetailResult,
  type ReportPeriod
} from "../api";

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "day", label: "日报" },
  { value: "month", label: "月报" },
  { value: "quarter", label: "季报" },
  { value: "year", label: "年报" }
];

type TraceableError = Error & { traceId?: string };

function asTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) {
    return error as TraceableError;
  }
  return new Error("指标明细加载失败");
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

function MetricDetailTable({ rows }: { rows: ReportMetricDetailItem[] }) {
  return (
    <Table
      rowKey="key"
      size="middle"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: "指标", dataIndex: "label" },
        { title: "数值", dataIndex: "value", render: (value: number, row) => `${value}${row.unit}` },
        { title: "说明", dataIndex: "hint" }
      ]}
    />
  );
}

export function ReportsMetricsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriod = (searchParams.get("period") as ReportPeriod | null) ?? "day";
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [filters, setFilters] = useState({
    country: searchParams.get("country") ?? "",
    sourceCategory: searchParams.get("source_category") ?? "",
    product: searchParams.get("product") ?? "",
    feedbackStatus: searchParams.get("feedback_status") ?? ""
  });
  const [data, setData] = useState<ReportMetricsDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TraceableError | null>(null);

  const appliedFilters = useMemo(() => compactFilters(filters), [filters]);

  async function load(nextPeriod = period) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReportMetricsDetail({ period: nextPeriod, ...appliedFilters, page: 1, pageSize: 10 });
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
      if (showToast) message.success("指标明细已确认");
    });
  }

  const cards = data?.metric_cards ?? [
    { key: "today_inquiries", label: "今日询盘", value: 0, unit: "", hint: "当日进入系统的询盘" },
    { key: "valid_leads", label: "有效线索", value: 0, unit: "", hint: "有效与高意向线索" },
    { key: "unfeedback", label: "未反馈", value: 0, unit: "", hint: "仍未收到销售反馈" },
    { key: "website_kpi", label: "官网 KPI", value: 0, unit: "%", hint: "官网来源占比" }
  ];
  const groups = data?.detail_groups ?? {};

  return (
    <section className="reports-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 报表中心</Typography.Text>
          <Typography.Title level={2}>指标明细</Typography.Title>
          <Typography.Paragraph className="muted">
            查看官网渠道 KPI、未反馈、销售反馈和产品分类等指标明细。
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
          message="指标明细加载失败"
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

      <Row gutter={[16, 16]} className="metric-row">
        {cards.map((metric) => (
          <Col xs={24} md={12} xl={6} key={metric.key}>
            <Card loading={loading}>
              <Statistic title={metric.label} value={metric.value} suffix={metric.unit} />
              <div className={metric.key === "valid_leads" ? "metric-chip green" : metric.key === "unfeedback" ? "metric-chip amber" : "metric-chip"}>
                {metric.hint}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="渠道质量" loading={loading}>
            <MetricDetailTable rows={groups.channels ?? []} />
            <div className="tag-cluster">
              <Typography.Text strong>产品分类</Typography.Text>
              {(groups.products ?? []).map((item) => (
                <Tag color="purple" key={item.key}>{item.label} {item.value}{item.unit}</Tag>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="官网 KPI" loading={loading}>
            <div className="timeline-list">
              {(groups.website_kpi ?? []).map((item) => (
                <div className="timeline-item" key={item.key}>
                  <strong>{item.label}</strong>
                  <span>{item.value}{item.unit}</span>
                </div>
              ))}
            </div>
            <div className="tag-cluster">
              <Typography.Text strong>销售反馈</Typography.Text>
              {(groups.sales_feedback ?? []).map((item) => (
                <Tag color={item.label.includes("未") ? "gold" : "green"} key={item.key}>{item.label} {item.value}{item.unit}</Tag>
              ))}
              {(groups.unfeedback ?? []).map((item) => (
                <Tag color="orange" key={item.key}>未反馈 · {item.label} {item.value}{item.unit}</Tag>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Space wrap>
          <Link to={`/admin/reports/period?period=${period}`}>
            <Button>查看周期报表</Button>
          </Link>
          <Link to={data?.downstream.metrics_path ?? `/admin/reports/metrics?period=${period}`}>
            <Button>查看指标明细</Button>
          </Link>
          <Link to={data?.downstream.export_path ?? `/admin/reports/export?period=${period}`}>
            <Button type="primary" icon={<Download size={16} />}>
              导出
            </Button>
          </Link>
        </Space>
        <Typography.Text className="muted">
          {data?.export_summary.desensitization ?? "导出客户联系信息时按角色权限脱敏"}
        </Typography.Text>
      </Card>

      <Card title="指标明细记录" loading={loading}>
        {data?.empty_state ? (
          <Empty
            description={data.empty_state.title}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Link to={data.empty_state.action_path}>
              <Button>{data.empty_state.action_label}</Button>
            </Link>
          </Empty>
        ) : (
          <Table
            rowKey="lead_id"
            dataSource={data?.items ?? []}
            pagination={false}
            columns={[
              { title: "客户", dataIndex: "customer_name" },
              { title: "国家", dataIndex: "country" },
              { title: "渠道", dataIndex: "source_category" },
              { title: "具体来源", dataIndex: "source_label" },
              { title: "产品", dataIndex: "product" },
              { title: "评分", dataIndex: "score_label" },
              { title: "反馈", dataIndex: "feedback_status" },
              {
                title: "动作",
                render: (_, row) => (
                  <Space>
                    <Link to={row.lead_detail_path}>线索</Link>
                    {row.customer_detail_path ? <Link to={row.customer_detail_path}>客户</Link> : null}
                  </Space>
                )
              }
            ]}
          />
        )}
      </Card>
    </section>
  );
}
