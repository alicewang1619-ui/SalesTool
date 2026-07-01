import { Alert, Button, Card, Col, Empty, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { Check, Filter, RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchDashboard, fetchLead, fetchLeads, fetchSourceDictionary, type Lead, type LeadFilters, type SourceOption } from "../api";

const scoreColor: Record<string, string> = {
  有效: "green",
  高意向: "purple",
  待补全: "orange",
  资料库: "gold"
};

const timeScopeOptions: Array<{ value: NonNullable<LeadFilters["timeScope"]>; label: string }> = [
  { value: "all", label: "全部历史" },
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨天" },
  { value: "date", label: "指定日期" }
];

const scoreOptions = [
  { value: "valid", label: "有效线索" },
  { value: "high", label: "高意向" },
  { value: "pending", label: "待补全" }
];

function uniqueCategories(sources: SourceOption[]) {
  return Array.from(new Set(sources.map((item) => item.category))).map((category) => ({ value: category, label: category }));
}

function normalizeScope(value: string | null): LeadFilters["timeScope"] {
  if (value === "today" || value === "yesterday" || value === "date" || value === "all") return value;
  return "all";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function scopeLabel(scope?: string, date?: string): string {
  if (scope === "today") return "今日";
  if (scope === "yesterday") return "昨天";
  if (scope === "date") return date ? `指定日期 ${date}` : "指定日期";
  return "全部历史";
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [source, setSource] = useState<string | undefined>(searchParams.get("source_category") ?? undefined);
  const [timeScope, setTimeScope] = useState<LeadFilters["timeScope"]>(normalizeScope(searchParams.get("time_scope")));
  const [date, setDate] = useState<string | undefined>(searchParams.get("date") ?? undefined);
  const [score, setScore] = useState<string | undefined>(searchParams.get("score") ?? undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [metrics, setMetrics] = useState({ today_inquiries: 0, valid_leads: 0, unfeedback: 0, website_kpi: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sourceOptions = useMemo(() => uniqueCategories(sources), [sources]);

  const currentFilters: LeadFilters = { page, pageSize, sourceCategory: source, timeScope, date, score };

  const syncSearchParams = (filters: LeadFilters) => {
    const params = new URLSearchParams();
    if (filters.sourceCategory) params.set("source_category", filters.sourceCategory);
    if (filters.timeScope && filters.timeScope !== "all") params.set("time_scope", filters.timeScope);
    if (filters.date) params.set("date", filters.date);
    if (filters.score) params.set("score", filters.score);
    setSearchParams(params);
  };

  const loadLeads = (filters = currentFilters) => {
    setLoading(true);
    setError(null);
    fetchLeads(filters)
      .then((result) => {
        setLeads(result.items);
        setTotal(result.total);
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSourceDictionary()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    fetchDashboard({ page: 1, pageSize: 1, sourceCategory: source, cycle: timeScope, date })
      .then((result) => setMetrics(result.metrics))
      .catch(() => setMetrics({ today_inquiries: 0, valid_leads: 0, unfeedback: 0, website_kpi: 0 }));
  }, [source, timeScope, date]);

  useEffect(() => {
    loadLeads();
  }, [page, pageSize, source, timeScope, date, score]);

  useEffect(() => {
    const recordId = Number(searchParams.get("recordId"));
    if (!recordId) {
      setSelectedLead(null);
      return;
    }
    fetchLead(recordId)
      .then(setSelectedLead)
      .catch(() => setSelectedLead(null));
  }, [searchParams]);

  const applyFilters = () => {
    const nextFilters = { ...currentFilters, page: 1 };
    setPage(1);
    syncSearchParams(nextFilters);
    loadLeads(nextFilters);
  };

  const clearFilters = () => {
    setSource(undefined);
    setTimeScope("all");
    setDate(undefined);
    setScore(undefined);
    setPage(1);
    setSearchParams(new URLSearchParams());
  };

  return (
    <section className="leads-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 线索池</Typography.Text>
          <Typography.Title level={2}>线索池列表</Typography.Title>
          <Typography.Paragraph className="muted">
            展示官网、邮箱、社媒和线下展会导入的线索；支持按来源、时间线和评分筛选。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => document.getElementById("lead-filters")?.scrollIntoView()}>
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
          message="线索池加载失败"
          description={error}
          action={
            <Button icon={<RefreshCw size={16} />} onClick={() => loadLeads()}>
              重试
            </Button>
          }
        />
      ) : null}

      {selectedLead ? (
        <Alert
          className="selected-record"
          showIcon
          type="info"
          message={`已选中线索：${selectedLead.customer_name}`}
          description={`${selectedLead.country} · ${selectedLead.customer_type} · ${selectedLead.product}`}
        />
      ) : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="当前线索" value={total} />
            <div className="metric-chip">{scopeLabel(timeScope, date)}</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="今日询盘" value={metrics.today_inquiries} />
            <div className="metric-chip">按当前来源归集</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="有效线索" value={metrics.valid_leads} />
            <div className="metric-chip green">评分与人工状态合并</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="未反馈" value={metrics.unfeedback} />
            <div className="metric-chip amber">需要继续跟进</div>
          </Card>
        </Col>
      </Row>

      <Card id="lead-filters" className="dashboard-toolbar">
        <Space wrap size="middle">
          <Select
            aria-label="时间范围"
            value={timeScope}
            options={timeScopeOptions}
            onChange={(value) => {
              setTimeScope(value);
              if (value !== "date") setDate(undefined);
              setPage(1);
            }}
            style={{ width: 140 }}
          />
          {timeScope === "date" ? (
            <Input aria-label="指定日期" type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ width: 160 }} />
          ) : null}
          <Select
            allowClear
            aria-label="线索来源"
            placeholder="全部来源"
            value={source}
            options={sourceOptions}
            onChange={(value) => {
              setSource(value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            aria-label="线索评分"
            placeholder="全部评分"
            value={score}
            options={scoreOptions}
            onChange={(value) => {
              setScore(value);
              setPage(1);
            }}
          />
          <Button type="primary" icon={<Check size={16} />} onClick={applyFilters}>
            应用
          </Button>
          <Button onClick={clearFilters}>清空</Button>
          <Button type="primary" icon={<Upload size={16} />} onClick={() => navigate("/admin/leads/import")}>
            导入线索
          </Button>
        </Space>
        <Typography.Text className="muted">
          当前显示：{scopeLabel(timeScope, date)} · {source ?? "全部来源"} · {score ?? "全部评分"}，共 {total} 条。
        </Typography.Text>
      </Card>

      <Card className="table-card">
        <Table<Lead>
          rowKey="id"
          loading={loading}
          dataSource={leads}
          scroll={{ x: 1280 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space direction="vertical">
                    <span>暂无符合筛选条件的线索</span>
                    <Button onClick={clearFilters}>清除筛选</Button>
                  </Space>
                }
              />
            )
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20"],
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }
          }}
          columns={[
            { title: "进入时间", dataIndex: "created_at", width: 180, render: formatDate },
            { title: "客户", dataIndex: "customer_name", fixed: "left", width: 180 },
            { title: "邮箱", dataIndex: "email", width: 220 },
            { title: "单位", dataIndex: "organization", width: 180 },
            { title: "国家", dataIndex: "country", width: 110 },
            { title: "产品", dataIndex: "product", width: 180 },
            {
              title: "来源",
              width: 180,
              render: (_, lead) => (
                <Space>
                  <Tag color="purple">{lead.source_category}</Tag>
                  <span>{lead.source_label}</span>
                </Space>
              )
            },
            {
              title: "评分",
              dataIndex: "score_label",
              width: 110,
              render: (value: string) => <Tag color={scoreColor[value] ?? "default"}>{value}</Tag>
            },
            { title: "负责人", dataIndex: "owner_name", width: 140 },
            { title: "反馈", dataIndex: "feedback_status", width: 120 },
            {
              title: "动作",
              fixed: "right",
              width: 120,
              render: (_, lead) => <Button onClick={() => navigate(`/admin/leads/${lead.id}`)}>查看详情</Button>
            }
          ]}
        />
      </Card>
    </section>
  );
}
