import { Card, Col, Row, Statistic, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { fetchSalesUsers, fetchSettingsSummary, type SalesUser } from "../api";

export function SettingsPage() {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<SalesUser[]>([]);

  useEffect(() => {
    void fetchSettingsSummary().then(setSummary);
    void fetchSalesUsers().then(setUsers);
  }, []);

  return (
    <section>
      <Typography.Text className="stage-label">阶段1(MVP) · 系统配置</Typography.Text>
      <Typography.Title level={2}>设置管理</Typography.Title>
      <Row gutter={16} className="metric-row">
        <Col span={8}><Card><Statistic title="销售与管理账号" value={summary.sales_users ?? 0} /></Card></Col>
        <Col span={8}><Card><Statistic title="启用来源" value={summary.sources ?? 0} /></Card></Col>
        <Col span={8}><Card><Statistic title="全站 Banner" value={summary.active_banners ?? 0} /></Card></Col>
      </Row>
      <Card title="销售账号">
        <Table<SalesUser>
          rowKey="id"
          dataSource={users}
          pagination={false}
          columns={[
            { title: "姓名", dataIndex: "name" },
            { title: "账号", dataIndex: "email" },
            { title: "角色", dataIndex: "role" },
            { title: "负责范围", dataIndex: "data_scope" },
            { title: "状态", render: (_, user) => (user.enabled ? "启用" : "停用") }
          ]}
        />
      </Card>
    </section>
  );
}
