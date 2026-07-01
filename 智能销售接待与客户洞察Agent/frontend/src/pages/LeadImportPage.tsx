import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { Download, FileSpreadsheet, RefreshCw, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  createImportJob,
  downloadImportFailures,
  downloadImportTemplate,
  fetchImportJob,
  retryImportJob,
  type ImportFailure,
  type ImportJob
} from "../api";

const reasonLabel: Record<string, string> = {
  DUPLICATE_CUSTOMER: "重复客户",
  MISSING_COUNTRY: "缺少国家",
  MISSING_CUSTOMER_NAME: "缺少客户名称",
  SOURCE_DISABLED: "来源已停用",
  COUNTRY_MAPPING_MISSING: "国家销售映射缺失"
};

function downloadTextFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function LeadImportPage() {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollImportJob = async (taskId: string) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const latest = await fetchImportJob(taskId);
      setJob(latest);
      if (latest.status === "completed") {
        message.success(
          `导入完成：成功 ${latest.success_rows} 行，自动分配 ${latest.auto_assigned_rows} 行，待人工确认 ${latest.pending_assignment_rows} 行`
        );
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
  };

  const uploadProps: UploadProps = {
    accept: ".csv,.xlsx",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      setSelectedFileName(file.name);
      setUploading(true);
      setError(null);
      try {
        const created = await createImportJob(file);
        setJob(created);
        message.success("导入任务已创建，正在处理文件");
        await pollImportJob(created.task_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "导入失败，请检查文件格式和字段");
      } finally {
        setUploading(false);
      }
      return Upload.LIST_IGNORE;
    }
  };

  const onRetry = async () => {
    if (!job) return;
    setRetrying(true);
    setError(null);
    try {
      const updated = await retryImportJob(job.task_id);
      setJob(updated);
      message.success("导入任务已重新处理");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重试失败");
    } finally {
      setRetrying(false);
    }
  };

  const onDownloadFailures = async () => {
    if (!job) return;
    const csv = await downloadImportFailures(job.task_id);
    downloadTextFile(`${job.task_id}-failed-rows.csv`, csv);
  };

  const onDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError(null);
    try {
      const csv = await downloadImportTemplate();
      downloadTextFile("客户线索导入模板.csv", csv);
      message.success("导入模板已下载");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模板下载失败");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <section className="lead-import-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="eyebrow">阶段 1 (MVP) · 线索池</Typography.Text>
          <Typography.Title level={1}>客户信息导入</Typography.Title>
          <Typography.Paragraph type="secondary">
            支持 CSV / Excel 文件。导入后系统会按“国家销售映射”自动匹配负责人，用户只需要确认异常与待分配结果。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Link to="/admin/leads">
            <Button>返回线索池</Button>
          </Link>
          <Button icon={<Download size={16} />} loading={downloadingTemplate} onClick={() => void onDownloadTemplate()}>
            下载模板
          </Button>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadCloud size={16} />} loading={uploading}>
              选择并上传文件
            </Button>
          </Upload>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Alert
        type="info"
        showIcon
        className="login-error"
        message={selectedFileName ? `已选择文件：${selectedFileName}` : "请选择 CSV 或 Excel 文件"}
        description="必填字段：customer_name、country、product、source_category；建议字段：email、organization、raw_inquiry。country 会用于自动分配销售。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="任务状态" value={job?.status ?? "待上传"} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="总行数" value={job?.total_rows ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="成功入库" value={job?.success_rows ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="失败行" value={job?.failed_rows ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="自动分配" value={job?.auto_assigned_rows ?? 0} />
            <div className="metric-chip green">按国家销售映射完成</div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待人工确认" value={job?.pending_assignment_rows ?? 0} />
            <div className="metric-chip amber">国家缺失或映射缺失</div>
          </Card>
        </Col>
      </Row>

      <Card
        title="导入任务"
        extra={
          job ? (
            <Space wrap>
              <Button icon={<RefreshCw size={16} />} loading={retrying} onClick={onRetry}>
                重试任务
              </Button>
              <Button icon={<Download size={16} />} onClick={onDownloadFailures} disabled={!job.failed_rows}>
                下载失败行
              </Button>
            </Space>
          ) : null
        }
      >
        {job ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              type={job.failed_rows || job.pending_assignment_rows ? "warning" : "success"}
              showIcon
              message={`${job.filename} 已创建导入任务 ${job.task_id}`}
              description={`已处理 ${job.processed_rows}/${job.total_rows} 行。自动分配成功的客户会直接进入对应销售范围；待人工确认项进入“待分配”。`}
            />
            <Table<ImportFailure>
              rowKey={(record) => `${record.row_number}-${record.reason}-${record.customer_name}`}
              dataSource={job.failures}
              pagination={false}
              locale={{ emptyText: "暂无失败行" }}
              columns={[
                { title: "行号", dataIndex: "row_number", width: 100 },
                { title: "客户", dataIndex: "customer_name" },
                {
                  title: "失败原因",
                  dataIndex: "reason",
                  render: (reason: string) => <Tag color="orange">{reasonLabel[reason] ?? reason}</Tag>
                }
              ]}
            />
          </Space>
        ) : (
          <Card size="small" className="settings-entry-card">
            <Space direction="vertical">
              <Space>
                <FileSpreadsheet size={18} />
                <Typography.Text strong>导入字段说明</Typography.Text>
              </Space>
              <Typography.Text className="muted">
                模板中的 country 可填写一个国家；系统会根据配置页“国家区域销售映射”自动找到负责人。一个销售可以负责多个国家。
              </Typography.Text>
              <Typography.Text className="muted">
                如果国家为空、没有映射或映射销售已停用，该行不会丢失，会进入“待分配”让运营确认。
              </Typography.Text>
            </Space>
          </Card>
        )}
      </Card>
    </section>
  );
}
