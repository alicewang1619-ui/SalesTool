import { Alert, Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { Check, Download, Filter, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReportHome, retryReportHome, type ReportHomeResult, type ReportPeriod } from "../api";

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "day", label: "日报" },
  { value: "month", label: "月报" },
  { value: "quarter", label: "季报" },
  { value: "year", label: "年报" }
];

const kpiRows: Array<{ key: keyof ReportHomeResult["website_kpi"]; label: string }> = [
  { key: "attribution_rate", label: "官网归因率" },
  { key: "ai_completion_rate", label: "AI 补全率" },
  { key: "assignment_rate", label: "分配完成率" },
  { key: "sales_feedback_rate", label: "销售反馈率" },
  { key: "entered_customer_pool", label: "进入客户池" }
];

export function ReportsHomePage() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [data, setData] = useState<ReportHomeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextPeriod = period) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReportHome({ period: nextPeriod, page: 1, pageSize: 10 });
      setData(result);
      setPeriod(result.period);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "报表数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("day");
  }, []);

  async function retryGeneration() {
    setRetrying(true);
    try {
      await retryReportHome();
      message.success("报表聚合已重新排队");
      await load(period);
    } finally {
      setRetrying(false);
    }
  }

  function exportCurrentReport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `report-home-${data.period}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const metricCards = data?.metrics ?? [];

  return (
    <section className="reports-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 报表中心</Typography.Text>
          <Typography.Title level={2}>报表中心首页</Typography.Title>
          <Typography.Paragraph className="muted">展示日报、月报、季报、年报入口和非金额核心指标。</Typography.Paragraph>
        </div>
        <Space wrap>
          <Select
            aria-label="报表周期"
            value={period}
            options={periodOptions}
            onChange={(value) => setPeriod(value)}
            style={{ width: 128 }}
          />
          <Button icon={<Filter size={16} />} onClick={() => void load(period)}>
            筛选
          </Button>
          <Button type="primary" icon={<Check size={16} />} onClick={() => void load(period)}>
            确认
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert
          showIcon
          type="error"
          message="报表数据加载失败"
          description={error}
          action={
            <Button icon={<RefreshCw size={16} />} onClick={() => void load(period)}>
              重试
            </Button>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} className="metric-row">
        {metricCards.map((metric) => (
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

      <Card className="dashboard-toolbar">
        <Space wrap>
          {data?.period_entries.map((entry) => (
            <Link to={entry.path} key={entry.period}>
              <Button>{entry.label}</Button>
            </Link>
          ))}
          <Link to={`/admin/reports/metrics?period=${period}`}>
            <Button>查看指标明细</Button>
          </Link>
          <Button icon={<Download size={16} />} disabled={!data} onClick={exportCurrentReport}>
            导出
          </Button>
        </Space>
        <Space wrap>
          <Tag color={data?.generation.status === "ready" ? "green" : "gold"}>{data?.generation.status ?? "loading"}</Tag>
          <Typography.Text className="muted">
            更新时间：{data?.generation.updated_at ? new Date(data.generation.updated_at).toLocaleString() : "--"}
          </Typography.Text>
          <Button loading={retrying} icon={<RefreshCw size={16} />} onClick={() => void retryGeneration()}>
            重新生成
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="渠道质量" loading={loading}>
            <Table
              rowKey="source_category"
              size="middle"
              pagination={false}
              dataSource={data?.channel_quality.items ?? []}
              columns={[
                { title: "渠道", dataIndex: "source_category" },
                { title: "询盘", dataIndex: "inquiry_count" },
                { title: "有效", dataIndex: "valid_count" },
                { title: "有效率", dataIndex: "valid_rate", render: (value: number) => `${value}%` }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="官网 KPI" loading={loading}>
            <div className="timeline-list">
              {kpiRows.map((row) => {
                const rawValue = data?.website_kpi[row.key] ?? 0;
                const suffix = row.key === "entered_customer_pool" ? "个客户" : "%";
                return (
                  <div className="timeline-item" key={row.key}>
                    <strong>{row.label}</strong>
                    <span>{rawValue}{suffix}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>
    </section>
  );
}
