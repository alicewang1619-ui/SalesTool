import { Alert, Button, Card, Col, List, Modal, Row, Space, Statistic, Tag, Typography } from "antd";
import { Check, Download, FileText, Filter, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  createReportExport,
  downloadReportExport,
  fetchReportExportContext,
  type ReportExportContextResult,
  type ReportExportTaskResult,
  type ReportPeriod
} from "../api";

const periodLabels: Record<ReportPeriod, string> = {
  day: "日报",
  month: "月报",
  quarter: "季报",
  year: "年报"
};

type TraceableError = Error & { traceId?: string };

function asTraceableError(error: unknown): TraceableError {
  if (error instanceof Error) {
    return error as TraceableError;
  }
  return new Error("导出确认信息加载失败");
}

function buildFilterPayload(searchParams: URLSearchParams) {
  return {
    period: ((searchParams.get("period") as ReportPeriod | null) ?? "day") as ReportPeriod,
    country: searchParams.get("country") ?? "",
    sourceCategory: searchParams.get("source_category") ?? "",
    product: searchParams.get("product") ?? "",
    feedbackStatus: searchParams.get("feedback_status") ?? ""
  };
}

function compactFilters(filters: ReturnType<typeof buildFilterPayload>) {
  return {
    period: filters.period,
    country: filters.country.trim() || undefined,
    sourceCategory: filters.sourceCategory.trim() || undefined,
    product: filters.product.trim() || undefined,
    feedbackStatus: filters.feedbackStatus.trim() || undefined
  };
}

function createReportPath(path: string, filters: ReturnType<typeof buildFilterPayload>) {
  const params = new URLSearchParams({ period: filters.period });
  if (filters.country) params.set("country", filters.country);
  if (filters.sourceCategory) params.set("source_category", filters.sourceCategory);
  if (filters.product) params.set("product", filters.product);
  if (filters.feedbackStatus) params.set("feedback_status", filters.feedbackStatus);
  return `${path}?${params.toString()}`;
}

function saveCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportsExportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => buildFilterPayload(searchParams), [searchParams]);
  const compacted = useMemo(() => compactFilters(filters), [filters]);
  const [context, setContext] = useState<ReportExportContextResult | null>(null);
  const [task, setTask] = useState<ReportExportTaskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const [error, setError] = useState<TraceableError | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReportExportContext(compacted);
      setContext(result);
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [compacted.period, compacted.country, compacted.sourceCategory, compacted.product, compacted.feedbackStatus]);

  function cancelExport() {
    navigate(context?.cancel_path ?? createReportPath("/admin/reports/period", filters));
  }

  async function confirmExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await createReportExport(compacted);
      setTask(result);
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setExporting(false);
    }
  }

  async function downloadTask() {
    if (!task) return;
    setDownloading(true);
    try {
      const csv = await downloadReportExport(task.task_id);
      saveCsv(`report-export-${task.task_id}.csv`, csv);
    } catch (failure) {
      setError(asTraceableError(failure));
    } finally {
      setDownloading(false);
    }
  }

  const filterItems = [
    ["周期", periodLabels[filters.period]],
    ["国家", filters.country || "全部国家"],
    ["渠道", filters.sourceCategory || "全部渠道"],
    ["产品", filters.product || "全部产品"],
    ["销售反馈", filters.feedbackStatus || "全部反馈"]
  ];

  return (
    <section className="reports-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段1(MVP) · 报表中心</Typography.Text>
          <Typography.Title level={2}>导出确认弹窗</Typography.Title>
          <Typography.Paragraph className="muted">
            确认导出周期、筛选范围、字段和脱敏策略后生成可审计导出任务。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => void load()}>
            筛选
          </Button>
          <Button type="primary" icon={<Check size={16} />} onClick={() => setModalOpen(true)}>
            确认
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert
          showIcon
          type="error"
          message="导出确认失败"
          description={
            <Space direction="vertical" size={2}>
              <span>{error.message}</span>
              {error.traceId ? <span>trace id：{error.traceId}</span> : null}
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="导出周期" value={periodLabels[context?.period ?? filters.period]} prefix={<FileText size={18} />} />
            <div className="metric-chip">继承当前报表上下文</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="预估行数" value={context?.estimated_rows ?? 0} />
            <div className="metric-chip green">后端按筛选范围统计</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="导出字段" value={context?.fields.length ?? 0} />
            <div className="metric-chip">仅限非金额字段</div>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={loading}>
            <Statistic title="脱敏策略" value="启用" prefix={<ShieldCheck size={18} />} />
            <div className="metric-chip amber">按角色权限处理</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="summary-grid">
        <Col xs={24} lg={12}>
          <Card title="导出范围" loading={loading}>
            <List
              size="small"
              dataSource={filterItems}
              renderItem={([label, value]) => (
                <List.Item>
                  <Typography.Text strong>{label}</Typography.Text>
                  <Typography.Text>{value}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="字段与脱敏" loading={loading}>
            <Space wrap className="tag-cluster">
              {(context?.fields ?? []).map((field) => (
                <Tag color="purple" key={field}>{field}</Tag>
              ))}
            </Space>
            <Typography.Paragraph className="muted" style={{ marginTop: 16 }}>
              {context?.desensitization ?? "导出客户联系信息时按角色权限脱敏"}
            </Typography.Paragraph>
            <Space wrap>
              {(context?.excludes ?? []).map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Space wrap>
          <Link to={createReportPath("/admin/reports/period", filters)}>
            <Button>查看周期报表</Button>
          </Link>
          <Link to={createReportPath("/admin/reports/metrics", filters)}>
            <Button>查看指标明细</Button>
          </Link>
          <Button type="primary" icon={<Download size={16} />} onClick={() => setModalOpen(true)}>
            导出
          </Button>
        </Space>
        <Typography.Text className="muted">导出确认后会写入审计日志并生成任务编号</Typography.Text>
      </Card>

      <Modal
        open={modalOpen}
        title="导出确认"
        okText={task ? "重新生成导出" : "确认导出"}
        cancelText="取消"
        onOk={() => void confirmExport()}
        onCancel={cancelExport}
        confirmLoading={exporting}
        keyboard
        maskClosable
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            showIcon
            type="info"
            message={`将导出 ${periodLabels[context?.period ?? filters.period]}，预估 ${context?.estimated_rows ?? 0} 条记录`}
            description={context?.desensitization ?? "导出客户联系信息时按角色权限脱敏"}
          />
          <List
            size="small"
            header={<Typography.Text strong>导出字段</Typography.Text>}
            dataSource={context?.fields ?? []}
            renderItem={(field) => <List.Item>{field}</List.Item>}
          />
          <Typography.Text className="muted">
            本次导出不包含成交金额、报价金额、原始询盘全文或会话历史。
          </Typography.Text>
          {task ? (
            <Alert
              showIcon
              type="success"
              message={`导出任务 ${task.task_id} 已生成`}
              description={`状态：${task.status}，实际导出 ${task.row_count} 条记录。`}
              action={
                <Button icon={<Download size={16} />} loading={downloading} onClick={() => void downloadTask()}>
                  下载
                </Button>
              }
            />
          ) : null}
          <Button icon={<X size={16} />} onClick={cancelExport}>
            取消并返回周期报表
          </Button>
        </Space>
      </Modal>
    </section>
  );
}
