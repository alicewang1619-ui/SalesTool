import { Layout, Menu, Typography } from "antd";
import { BarChart3, CircleUserRound, ClipboardList, Database, Home, Send, Settings, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, fetchMe, getToken } from "../api";
import { GlobalBanner } from "./GlobalBanner";

const { Sider, Content } = Layout;

const navItems = [
  { key: "/admin/dashboard", icon: <Home size={18} />, label: "工作台", roles: ["admin", "ops", "sales"] },
  { key: "/admin/leads", icon: <Database size={18} />, label: "线索池", roles: ["admin", "ops", "sales"] },
  { key: "/admin/assignments/pending", icon: <ClipboardList size={18} />, label: "待分配", roles: ["admin", "ops"] },
  { key: "/admin/customers", icon: <UsersRound size={18} />, label: "客户池", roles: ["admin", "ops", "sales"] },
  { key: "/admin/nurture", icon: <Send size={18} />, label: "再营销", roles: ["admin", "ops", "sales"] },
  { key: "/admin/reports", icon: <BarChart3 size={18} />, label: "报表", roles: ["admin", "ops"] },
  { key: "/admin/settings", icon: <Settings size={18} />, label: "配置", roles: ["admin", "ops"] },
  { key: "/admin/me", icon: <CircleUserRound size={18} />, label: "我的", roles: ["admin", "ops", "sales"] }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionState, setSessionState] = useState<"checking" | "valid" | "expired">("checking");
  const [user, setUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setSessionState("expired");
      return;
    }
    let alive = true;
    fetchMe()
      .then((currentUser) => {
        if (!alive) return;
        setUser(currentUser);
        setSessionState("valid");
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

  const salesRestricted =
    user?.role === "sales" &&
    !location.pathname.startsWith("/admin/forbidden") &&
    ["/admin/settings", "/admin/reports", "/admin/assignments", "/admin/customer-signals"].some((path) =>
      location.pathname.startsWith(path)
    );

  if (salesRestricted) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/admin/forbidden?from=${encodeURIComponent(from)}&reason=FORBIDDEN`} replace />;
  }

  const allowedItems = navItems
    .filter((item) => !user?.role || item.roles.includes(user.role))
    .map(({ roles, ...item }) => item);

  const selectedKey = location.pathname.startsWith("/admin/leads")
    ? "/admin/leads"
    : location.pathname.startsWith("/admin/assignments")
      ? "/admin/assignments/pending"
      : location.pathname.startsWith("/admin/customers") || location.pathname.startsWith("/admin/customer-signals")
        ? "/admin/customers"
        : location.pathname.startsWith("/admin/nurture")
          ? "/admin/nurture"
          : location.pathname.startsWith("/admin/reports")
            ? "/admin/reports"
            : location.pathname.startsWith("/admin/settings")
              ? "/admin/settings"
              : location.pathname.startsWith("/admin/me")
                ? "/admin/me"
                : location.pathname;

  return (
    <Layout className="app-shell" aria-busy={sessionState === "checking"}>
      <Sider width={256} className="side-nav">
        <div className="brand">
          <div className="brand-mark">UG</div>
          <Typography.Title level={4}>Ultrasound Growth</Typography.Title>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={allowedItems} onClick={(event) => navigate(event.key)} />
      </Sider>
      <Layout>
        <GlobalBanner />
        <Content className="page-content">
          {sessionState === "valid" ? <Outlet /> : <div className="muted">正在校验会话</div>}
        </Content>
      </Layout>
    </Layout>
  );
}
