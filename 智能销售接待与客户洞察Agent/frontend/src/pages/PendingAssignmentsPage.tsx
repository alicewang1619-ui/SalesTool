import { Alert, Button, Card, Empty, Input, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { RefreshCw, Route, Save, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  confirmPendingAssignment,
  fetchPendingAssignments,
  fetchSalesUsers,
  type LeadFilters,
  type PendingAssignment,
  type SalesUser
} from "../api";

const reasonLabel: Record<string, string> = {
  COUNTRY_MISSING: "国家缺失",
  COUNTRY_MAPPING_MISSING: "国家映射缺失",
  ASSIGNEE_MISSING: "负责人缺失"
};

const scoreColor: Record<string, string> = {
  有效: "green",
  高意向: "purple",
  待补全: "orange",
  资料库: "gold",
  pending: "orange"
};

const timeScopeOptions: Array<{ value: NonNullable<LeadFilters["timeScope"]>; label: string }> = [
  { value: "all", label: "全部历史" },
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨天" },
  { value: "date", label: "指定日期" }
];

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

export function PendingAssignmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PendingAssignment[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [assigneeByLead, setAssigneeByLead] = useState<Record<number, number>>({});
  const [timeScope, setTimeScope] = useState<LeadFilters["timeScope"]>(normalizeScope(searchParams.get("time_scope")));
  const [date, setDate] = useState<string | undefined>(searchParams.get("date") ?? undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const salesOptions = useMemo(
    () => salesUsers.filter((item) => item.role === "sales" && item.enabled).map((item) => ({ value: item.id, label: item.name })),
    [salesUsers]
  );

  const metrics = useMemo(
    () => ({
      mappingMissing: items.filter((item) => item.pending_reasons.includes("COUNTRY_MAPPING_MISSING")).length,
      assigneeMissing: items.filter((item) => item.pending_reasons.includes("ASSIGNEE_MISSING")).length
    }),
    [items]
  );

  const syncSearchParams = () => {
    const params = new URLSearchParams();
    if (timeScope && timeScope !== "all") params.set("time_scope", timeScope);
    if (date) params.set("date", date);
    setSearchParams(params);
  };

  const loadPage = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchPendingAssignments({ page, pageSize, timeScope, date }), fetchSalesUsers().catch(() => [])])
      .then(([result, users]) => {
        setItems(result.items);
        setTotal(result.total);
        setSalesUsers(users);
        setAssigneeByLead((current) => {
          const next = { ...current };
          result.items.forEach((item) => {
            if (!next[item.id] && item.suggested_owner_id) {
              next[item.id] = item.suggested_owner_id;
            }
          });
          return next;
        });
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPage();
  }, [page, pageSize, timeScope, date]);

  async function assignLead(lead: PendingAssignment) {
    const ownerId = assigneeByLead[lead.id];
    if (!ownerId) {
      message.warning("请选择销售负责人");
      return;
    }
    setSavingId(lead.id);
    try {
      const result = await confirmPendingAssignment(lead.id, { ownerId, expectedOwnerId: lead.owner_id });
      message.success(`已分配给 ${result.owner_name}，反馈链接 7 天有效`);
      loadPage();
    } catch (failure) {
      message.error(failure instanceof Error ? failure.message : "分配失败，请刷新后重试");
    } finally {
      setSavingId(null);
    }
  }

  const applyTimeFilter = () => {
    setPage(1);
    syncSearchParams();
    loadPage();
  };

  const columns: ColumnsType<PendingAssignment> = [
    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
    { title: "客户", dataIndex: "customer_name", fixed: "left", width: 180 },
    { title: "国家", dataIndex: "country", width: 120 },
    { title: "产品", dataIndex: "product", width: 180 },
    {
      title: "评分",
      dataIndex: "score_label",
      width: 110,
      render: (value: string) => <Tag color={scoreColor[value] ?? "default"}>{value}</Tag>
    },
    { title: "反馈", dataIndex: "feedback_status", width: 130 },
    {
      title: "待处理原因",
      dataIndex: "pending_reasons",
      width: 230,
      render: (reasons: string[]) => (
        <Space wrap>
          {reasons.map((reason) => (
            <Tag key={reason} color={reason === "COUNTRY_MAPPING_MISSING" ? "orange" : "purple"}>
              {reasonLabel[reason] ?? reason}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: "动作",
      width: 280,
      fixed: "right",
      render: (_, lead) => (
        <Space direction="vertical" size={8}>
          <Select
            aria-label={`${lead.customer_name} 销售负责人`}
            placeholder="选择销售"
            value={assigneeByLead[lead.id]}
            options={salesOptions}
            onChange={(value) => setAssigneeByLead((current) => ({ ...current, [lead.id]: value }))}
            style={{ width: 220 }}
          />
          <Space wrap>
            <Button onClick={() => navigate(lead.detail_path)}>查看详情</Button>
            {lead.configure_mapping_path ? (
              <Button icon={<Settings size={16} />} onClick={() => navigate(lead.configure_mapping_path ?? "/admin/settings")}>
                配置映射
              </Button>
            ) : null}
            <Button type="primary" icon={<Save size={16} />} loading={savingId === lead.id} onClick={() => void assignLead(lead)}>
              确认分配
            </Button>
          </Space>
        </Space>
      )
    }
  ];

  return (
    <section className="pending-assignments-page">
      <div className="page-heading">
        <div>
          <Typography.Text className="stage-label">阶段 1 (MVP) · 分发与反馈</Typography.Text>
          <Typography.Title level={2}>待分配列表</Typography.Title>
          <Typography.Paragraph className="muted">
            集中处理国家缺失、国家映射缺失或负责人缺失的线索；支持查看今日、昨天、指定日期和全部历史任务。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={loadPage}>
            刷新
          </Button>
          <Button icon={<Route size={16} />} onClick={() => navigate("/admin/settings/country-sales")}>
            国家销售映射
          </Button>
        </Space>
      </div>

      {error ? (
        <Alert
          showIcon
          type="error"
          message="待分配列表加载失败"
          description={error}
          action={
            <Button icon={<RefreshCw size={16} />} onClick={loadPage}>
              重试
            </Button>
          }
        />
      ) : null}

      <Card className="dashboard-toolbar">
        <Space wrap>
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
          <Button type="primary" onClick={applyTimeFilter}>
            应用时间线
          </Button>
        </Space>
        <Typography.Text className="muted">
          当前时间线：{scopeLabel(timeScope, date)}，共 {total} 条待分配。
        </Typography.Text>
      </Card>

      <div className="assignment-metrics">
        <Card>
          <Statistic title="待处理线索" value={total} />
          <div className="metric-chip">{scopeLabel(timeScope, date)}</div>
        </Card>
        <Card>
          <Statistic title="映射缺失" value={metrics.mappingMissing} />
          <div className="metric-chip amber">需进入配置补齐</div>
        </Card>
        <Card>
          <Statistic title="负责人缺失" value={metrics.assigneeMissing} />
          <div className="metric-chip">可直接分配销售</div>
        </Card>
      </div>

      <Card className="table-card">
        <Table<PendingAssignment>
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{ x: 1320 }}
          locale={{
            emptyText: (
              <Empty description="暂无待分配线索">
                <Button onClick={() => navigate("/admin/leads/import")}>导入线索</Button>
              </Empty>
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
        />
      </Card>
    </section>
  );
}
