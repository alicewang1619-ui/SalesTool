import React from "react";
import ReactDOM from "react-dom/client";
import "@ant-design/v5-patch-for-react-19";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { LeadImportPage } from "./pages/LeadImportPage";
import { ProspectingPage } from "./pages/ProspectingPage";
import { FeedbackCardPage } from "./pages/FeedbackCardPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import { NurtureTaskDetailPage } from "./pages/NurtureTaskDetailPage";
import { NurtureTasksPage } from "./pages/NurtureTasksPage";
import { PendingAssignmentsPage } from "./pages/PendingAssignmentsPage";
import { ReportsHomePage } from "./pages/ReportsHomePage";
import { ReportsExportPage } from "./pages/ReportsExportPage";
import { ReportsMetricsPage } from "./pages/ReportsMetricsPage";
import { ReportsPeriodPage } from "./pages/ReportsPeriodPage";
import { CountrySalesMappingPage } from "./pages/CountrySalesMappingPage";
import { ProductKnowledgePage } from "./pages/ProductKnowledgePage";
import { SettingsPage } from "./pages/SettingsPage";
import { MyProfilePage } from "./pages/MyProfilePage";
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
      { path: "prospecting", element: <ProspectingPage /> },
      { path: "assignments/pending", element: <PendingAssignmentsPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/:customerId", element: <CustomerDetailPage /> },
      { path: "customer-signals", element: <Navigate to="/admin/customers" replace /> },
      { path: "nurture", element: <NurtureTasksPage /> },
      { path: "nurture/:taskId", element: <NurtureTaskDetailPage /> },
      { path: "marketing-skills", element: <SettingsPage standaloneSection="marketing" /> },
      { path: "knowledge-base", element: <ProductKnowledgePage /> },
      { path: "reports", element: <ReportsHomePage /> },
      { path: "reports/period", element: <ReportsPeriodPage /> },
      { path: "reports/metrics", element: <ReportsMetricsPage /> },
      { path: "reports/export", element: <ReportsExportPage /> },
      { path: "forbidden", element: <ForbiddenPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/country-sales", element: <CountrySalesMappingPage /> },
      { path: "settings/product-knowledge", element: <ProductKnowledgePage /> },
      { path: "me", element: <MyProfilePage /> }
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
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
