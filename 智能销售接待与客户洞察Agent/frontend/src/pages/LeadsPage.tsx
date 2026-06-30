import { Button, Select, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLeads, type Lead } from "../api";

export function LeadsPage() {
  const [source, setSource] = useState<string | undefined>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchLeads(source).then((result) => setLeads(result.items));
  }, [source]);

  return (
    <section>
      <Typography.Text className="stage-label">阶段1(MVP) · 线索池</Typography.Text>
      <Typography.Title level={2}>线索池列表</Typography.Title>
      <Space className="toolbar">
        <Select
          allowClear
          placeholder="线索来源"
          style={{ width: 220 }}
          value={source}
          onChange={setSource}
          options={["网站", "邮箱", "社媒", "线下展会", "其他"].map((item) => ({ label: item, value: item }))}
        />
        <Button type="primary">导入线索</Button>
      </Space>
      <Table<Lead>
        rowKey="id"
        dataSource={leads}
        columns={[
          { title: "客户", dataIndex: "customer_name" },
          { title: "国家", dataIndex: "country" },
          { title: "类型", dataIndex: "customer_type" },
          { title: "产品", dataIndex: "product" },
          { title: "来源", render: (_, lead) => <><Tag>{lead.source_category}</Tag>{lead.source_label}</> },
          { title: "评分", dataIndex: "score_label" },
          { title: "反馈", dataIndex: "feedback_status" },
          { title: "动作", render: () => <Button onClick={() => navigate("/admin/customers/1")}>查看详情</Button> }
        ]}
      />
    </section>
  );
}
