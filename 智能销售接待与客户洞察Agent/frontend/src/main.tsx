import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { LeadImportPage } from "./pages/LeadImportPage";
import { FeedbackCardPage } from "./pages/FeedbackCardPage";
import { LoginPage } from "./pages/LoginPage";
import { PendingAssignmentsPage } from "./pages/PendingAssignmentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  { path: "/feedback/:token", element: <FeedbackCardPage /> },
  {
    path: "/admin",
    element: <AppShell />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "leads", element: <LeadsPage /> },
      { path: "leads/import", element: <LeadImportPage /> },
      { path: "leads/:leadId", element: <LeadDetailPage /> },
      { path: "assignments/pending", element: <PendingAssignmentsPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/:customerId", element: <CustomerDetailPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#5B4BE8",
          borderRadius: 8,
          fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif"
        }
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  </React.StrictMode>
);
