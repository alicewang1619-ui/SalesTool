import { Button, Card, Col, Empty, Row, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { CheckCircle2, Filter, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNurtureTasks, type NurtureTask, type NurtureTaskPageResult } from "../api";

const statusLabels: Record<string, string> = {
  pending: "待确认",
  confirmed: "已确认",
  cancelled: "已取消"
};

const statusColors: Record<string, string> = {
  pending: "purple",
  confirmed: "green",
  cancelled: "default"
};

export function NurtureTasksPage() {
  const [data, setData] = useState<NurtureTaskPageResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function load(page = 1, pageSize = 10, status = statusFilter) {
    setLoading(true);
    try {
      const result = await fetchNurtureTasks({ page, pageSize, status });
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function applyStatus(nextStatus?: string) {
    setStatusFilter(nextStatus);
    void load(1, data?.page_size ?? 10, nextStatus);
    message.success("再营销筛选已更新");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 2 · 再营销待办</Typography.Text>
          <Typography.Title level={2}>再营销待办列表</Typography.Title>
          <Typography.Paragraph className="muted">
            从客户池选择适合下一步触达的客户，查看建议动作、提示词、附件素材和待确认草稿。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<Filter size={16} />} onClick={() => void load(1, data?.page_size ?? 10)}>
            刷新
          </Button>
          <Button type="primary" icon={<CheckCircle2 size={16} />}>
            人工确认队列
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="待确认草稿" value={data?.summary.pending ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已确认" value={data?.summary.confirmed ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="带附件素材" value={data?.summary.with_attachments ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card className="dashboard-toolbar">
        <Space wrap>
          <Select
            allowClear
            placeholder="全部草稿状态"
            value={statusFilter}
            onChange={applyStatus}
            options={[
              { value: "pending", label: "待确认" },
              { value: "confirmed", label: "已确认" },
              { value: "cancelled", label: "已取消" }
            ]}
            style={{ width: 180 }}
          />
        </Space>
      </Card>

      <Card className="table-card">
        <Table<NurtureTask>
          rowKey="id"
          loading={loading}
          dataSource={data?.items ?? []}
          locale={{
            emptyText: <Empty description={data?.empty_state?.title ?? "暂无再营销任务"} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.page_size ?? 10,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (page, pageSize) => void load(page, pageSize)
          }}
          columns={[
            { title: "客户", dataIndex: "customer_name", fixed: "left", width: 190 },
            { title: "客户分层", dataIndex: "customer_tier", width: 130, render: (tier) => <Tag color="purple">{tier}</Tag> },
            { title: "建议下一步动作", dataIndex: "recommended_next_action", width: 300 },
            { title: "客户备注", dataIndex: "customer_note", width: 260 },
            {
              title: "提示词/附件",
              key: "prompt",
              width: 150,
              render: (_, record) => (
                <Space size={6}>
                  <Tag color={record.generation_prompt ? "blue" : "default"}>提示词</Tag>
                  <Tag color={record.attachments.length ? "green" : "gold"}>{record.attachments.length} 附件</Tag>
                </Space>
              )
            },
            {
              title: "草稿状态",
              dataIndex: "approval_status",
              width: 120,
              render: (status) => <Tag color={statusColors[status] ?? "default"}>{statusLabels[status] ?? status}</Tag>
            },
            {
              title: "动作",
              key: "action",
              fixed: "right",
              width: 140,
              render: (_, record) => (
                <Link to={record.detail_path}>
                  <Button icon={<FileText size={16} />}>查看草稿</Button>
                </Link>
              )
            }
          ]}
          scroll={{ x: 1320 }}
        />
      </Card>
    </>
  );
}
