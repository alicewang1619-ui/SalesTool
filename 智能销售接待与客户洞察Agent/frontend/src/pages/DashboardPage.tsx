import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { Check, Filter, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboard, type DashboardResult, type DashboardTodo } from "../api";

const scoreColor: Record<string, string> = {
  有效: "green",
  高意向: "purple",
  待补充: "orange",
  资料库: "gold",
  "鏈夋晥": "green"
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    fetchDashboard()
      .then((result) => {
        setDashboard(result);
        setError(null);
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = dashboard?.metrics;

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1 (MVP) · 工作台</Typography.Text>
          <Typography.Title level={2}>工作台首页</Typography.Title>
          <Typography.Paragraph className="muted">
            统一查看今日询盘、有效线索、未反馈和官网 KPI，所有指标由后端按当前账号权限聚合。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />}>筛选</Button>
          <Button type="primary" icon={<Check size={16} />}>
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
            <Button icon={<RefreshCw size={16} />} onClick={loadDashboard}>
              重试
            </Button>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="今日询盘" value={metrics?.today_inquiries ?? 0} />
            <div className="metric-chip">网站与邮件来源实时归集</div>
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

      <Card className="dashboard-toolbar">
        <Space wrap size="middle">
          <Input aria-label="线索来源" readOnly value="全部来源" />
          <Select aria-label="国家" value="全部国家" options={[{ value: "全部国家", label: "全部国家" }]} />
          <Select aria-label="产品" value="全部产品" options={[{ value: "全部产品", label: "全部产品" }]} />
          <Button icon={<RefreshCw size={16} />} onClick={loadDashboard}>
            刷新
          </Button>
          <Button type="primary" icon={<Upload size={16} />}>
            导入线索
          </Button>
        </Space>
        <Typography.Text className="muted">
          当前显示：按当前账号权限返回的 {dashboard?.total ?? 0} 条待办记录
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
          pagination={false}
          scroll={{ x: 900 }}
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
