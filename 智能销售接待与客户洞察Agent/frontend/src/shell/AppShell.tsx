import { Layout, Menu, Typography } from "antd";
import { BarChart3, ClipboardList, Database, Home, Settings, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, fetchMe, getToken } from "../api";
import { GlobalBanner } from "./GlobalBanner";

const { Sider, Content } = Layout;

const items = [
  { key: "/admin/dashboard", icon: <Home size={18} />, label: "工作台" },
  { key: "/admin/leads", icon: <Database size={18} />, label: "线索池" },
  { key: "/admin/assignments/pending", icon: <ClipboardList size={18} />, label: "待分配" },
  { key: "/admin/customers", icon: <UsersRound size={18} />, label: "客户池" },
  { key: "/admin/reports", icon: <BarChart3 size={18} />, label: "报表" },
  { key: "/admin/settings", icon: <Settings size={18} />, label: "配置" }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionState, setSessionState] = useState<"checking" | "valid" | "expired">("checking");

  useEffect(() => {
    if (!getToken()) {
      setSessionState("expired");
      return;
    }
    let alive = true;
    fetchMe()
      .then(() => {
        if (alive) setSessionState("valid");
      })
      .catch(() => {
        clearSession();
        if (alive) setSessionState("expired");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (sessionState === "expired") {
    return <Navigate to="/?reason=expired" replace />;
  }
  const selectedKey = location.pathname.startsWith("/admin/leads")
    ? "/admin/leads"
    : location.pathname.startsWith("/admin/assignments")
      ? "/admin/assignments/pending"
      : location.pathname.startsWith("/admin/customers")
        ? "/admin/customers"
      : location.pathname.startsWith("/admin/reports")
        ? "/admin/reports"
      : location.pathname;

  return (
    <Layout className="app-shell" aria-busy={sessionState === "checking"}>
      <Sider width={256} className="side-nav">
        <div className="brand">
          <div className="brand-mark">UG</div>
          <Typography.Title level={4}>Ultrasound Growth</Typography.Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={(event) => navigate(event.key)}
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
