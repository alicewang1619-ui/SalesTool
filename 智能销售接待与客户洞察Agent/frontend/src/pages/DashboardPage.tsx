import { Card, Col, Row, Statistic, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { fetchLeads, type Lead } from "../api";

export function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    void fetchLeads().then((result) => setLeads(result.items));
  }, []);

  return (
    <section>
      <Typography.Text className="stage-label">阶段1(MVP) · 工作台</Typography.Text>
      <Typography.Title level={2}>工作台首页</Typography.Title>
      <Row gutter={16} className="metric-row">
        <Col span={6}><Card><Statistic title="今日询盘" value={leads.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="有效线索" value={leads.filter((lead) => lead.score_label === "有效").length} /></Card></Col>
        <Col span={6}><Card><Statistic title="未反馈" value={leads.filter((lead) => lead.feedback_status === "未反馈").length} /></Card></Col>
        <Col span={6}><Card><Statistic title="官网 KPI" value={71} suffix="%" /></Card></Col>
      </Row>
      <Table<Lead>
        rowKey="id"
        dataSource={leads}
        pagination={false}
        columns={[
          { title: "客户", dataIndex: "customer_name" },
          { title: "国家", dataIndex: "country" },
          { title: "产品", dataIndex: "product" },
          { title: "来源", dataIndex: "source_category" },
          { title: "反馈", dataIndex: "feedback_status" }
        ]}
      />
    </section>
  );
}
