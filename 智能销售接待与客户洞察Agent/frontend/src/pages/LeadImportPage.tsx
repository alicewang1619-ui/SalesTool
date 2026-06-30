import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography, Upload, message } from "antd";
import type { UploadProps } from "antd";
import { Download, RefreshCw, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { createImportJob, downloadImportFailures, retryImportJob, type ImportFailure, type ImportJob } from "../api";

const reasonLabel: Record<string, string> = {
  DUPLICATE_CUSTOMER: "重复客户",
  MISSING_COUNTRY: "缺失国家",
  MISSING_CUSTOMER_NAME: "缺失客户名称",
  SOURCE_DISABLED: "来源已停用"
};

export function LeadImportPage() {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadProps: UploadProps = {
    accept: ".csv,.xlsx",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      setUploading(true);
      setError(null);
      try {
        const created = await createImportJob(file);
        setJob(created);
        message.success(`导入任务已完成：成功 ${created.success_rows} 行，失败 ${created.failed_rows} 行`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "导入失败");
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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${job.task_id}-failed-rows.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="lead-import-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="eyebrow">阶段1(MVP) · 线索池</Typography.Text>
          <Typography.Title level={1}>渠道导入</Typography.Title>
          <Typography.Paragraph type="secondary">
            处理官网后台、邮箱和展会名片的 CSV/Excel 导入、失败项和重复提示。
          </Typography.Paragraph>
        </div>
        <Space>
          <Link to="/admin/leads">
            <Button>返回线索池</Button>
          </Link>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadCloud size={16} />} loading={uploading}>
              上传导入文件
            </Button>
          </Upload>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card><Statistic title="任务状态" value={job?.status ?? "待上传"} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="总行数" value={job?.total_rows ?? 0} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="已处理" value={job?.processed_rows ?? 0} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card><Statistic title="成功入库" value={job?.success_rows ?? 0} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card><Statistic title="失败行" value={job?.failed_rows ?? 0} /></Card>
        </Col>
      </Row>

      <Card
        title="导入任务"
        extra={
          job ? (
            <Space>
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
              type={job.failed_rows ? "warning" : "success"}
              showIcon
              message={`${job.filename} 已写入后端导入任务 ${job.task_id}`}
              description="成功行已持久化到线索池；失败行保留原因，可下载后修正再导入。"
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
          <Alert
            type="info"
            showIcon
            message="请上传 CSV 文件开始导入"
            description="文件会进入后端上传接口，系统完成来源字典校验、重复客户识别和缺失字段检查后返回任务结果。"
          />
        )}
      </Card>
    </section>
  );
}
