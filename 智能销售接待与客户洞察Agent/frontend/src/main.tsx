import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  {
    path: "/admin",
    element: <AppShell />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "leads", element: <LeadsPage /> },
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

