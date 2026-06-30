import { Alert, Button, Card, Col, Empty, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { Check, Filter, RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchDashboard, fetchLead, fetchLeads, fetchSourceDictionary, type Lead, type SourceOption } from "../api";

const scoreColor: Record<string, string> = {
  有效: "green",
  高意向: "purple",
  待补充: "orange",
  资料库: "gold"
};

function uniqueCategories(sources: SourceOption[]) {
  return Array.from(new Set(sources.map((item) => item.category))).map((category) => ({ value: category, label: category }));
}

export function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [source, setSource] = useState<string | undefined>();
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

  const loadLeads = () => {
    setLoading(true);
    setError(null);
    fetchLeads({ page, pageSize, sourceCategory: source })
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
    fetchDashboard({ page: 1, pageSize: 1, sourceCategory: source })
      .then((result) => setMetrics(result.metrics))
      .catch(() => setMetrics({ today_inquiries: 0, valid_leads: 0, unfeedback: 0, website_kpi: 0 }));
  }, [source]);

  useEffect(() => {
    loadLeads();
  }, [page, pageSize, source]);

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

  const clearSource = () => {
    setSource(undefined);
    setPage(1);
  };

  return (
    <section className="leads-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1 (MVP) · 线索池</Typography.Text>
          <Typography.Title level={2}>线索池列表</Typography.Title>
          <Typography.Paragraph className="muted">
            统一展示网站、邮箱、社媒、线下展会和其他来源线索；来源筛选读取后台启用字典。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => document.getElementById("lead-filters")?.scrollIntoView()}>
            筛选
          </Button>
          <Button type="primary" icon={<Check size={16} />} onClick={loadLeads}>
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
            <Button icon={<RefreshCw size={16} />} onClick={loadLeads}>
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
          message={`已选择线索：${selectedLead.customer_name}`}
          description={`${selectedLead.country} · ${selectedLead.customer_type} · ${selectedLead.product}`}
        />
      ) : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="今日询盘" value={metrics.today_inquiries} />
            <div className="metric-chip">按当前来源后端归集</div>
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
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="官网 KPI" value={metrics.website_kpi} suffix="%" />
            <div className="metric-chip">可归因率</div>
          </Card>
        </Col>
      </Row>

      <Card id="lead-filters" className="dashboard-toolbar">
        <Space wrap size="middle">
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
          <Select aria-label="国家" placeholder="全部国家" disabled />
          <Select aria-label="产品" placeholder="全部产品" disabled />
          <Button onClick={() => navigate("/admin/settings")}>管理来源</Button>
          <Button type="primary" icon={<Upload size={16} />} onClick={() => navigate("/admin/leads/import")}>
            导入线索
          </Button>
        </Space>
        <Typography.Text className="muted">
          当前显示：{source ?? "全部来源"}，共 {total} 条；来源选项来自后台来源字典
        </Typography.Text>
      </Card>

      <Card className="table-card">
        <Table<Lead>
          rowKey="id"
          loading={loading}
          dataSource={leads}
          scroll={{ x: 980 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space direction="vertical">
                    <span>{source ? `暂无 ${source} 来源线索` : "暂无线索"}</span>
                    {source ? <Button onClick={clearSource}>清除来源筛选</Button> : null}
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
            { title: "客户", dataIndex: "customer_name" },
            { title: "国家", dataIndex: "country" },
            { title: "类型", dataIndex: "customer_type" },
            { title: "产品", dataIndex: "product" },
            {
              title: "来源",
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
              render: (value: string) => <Tag color={scoreColor[value] ?? "default"}>{value}</Tag>
            },
            { title: "反馈", dataIndex: "feedback_status" },
            {
              title: "动作",
              render: (_, lead) => <Button onClick={() => navigate(`/admin/leads/${lead.id}`)}>查看详情</Button>
            }
          ]}
        />
      </Card>
    </section>
  );
}
