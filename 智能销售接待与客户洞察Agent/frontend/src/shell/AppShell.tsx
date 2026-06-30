import { Layout, Menu, Typography } from "antd";
import { BarChart3, Database, Home, Settings, UsersRound } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { GlobalBanner } from "./GlobalBanner";

const { Sider, Content } = Layout;

const items = [
  { key: "/admin/dashboard", icon: <Home size={18} />, label: "工作台" },
  { key: "/admin/leads", icon: <Database size={18} />, label: "线索池" },
  { key: "/admin/customers/1", icon: <UsersRound size={18} />, label: "客户详情" },
  { key: "/admin/settings", icon: <Settings size={18} />, label: "配置" },
  { key: "reports", icon: <BarChart3 size={18} />, label: "报表" }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="app-shell">
      <Sider width={256} className="side-nav">
        <div className="brand">
          <div className="brand-mark">⌁</div>
          <Typography.Title level={4}>Ultrasound Growth</Typography.Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={(event) => {
            if (event.key !== "reports") navigate(event.key);
          }}
        />
      </Sider>
      <Layout>
        <GlobalBanner />
        <Content className="page-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
