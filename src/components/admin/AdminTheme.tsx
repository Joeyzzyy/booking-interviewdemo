"use client";

import { App, ConfigProvider, theme } from "antd";
import zhHK from "antd/locale/zh_HK";

/**
 * 管理後台 antd 主題：淺色調藍色系（#2563eb 主色）。
 * antd App 組件提供 message / modal 上下文（所有提示與彈窗走這套，不用瀏覽器原生）。
 */
export default function AdminTheme({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhHK}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#2563eb",
          colorInfo: "#2563eb",
          colorLink: "#1d4ed8",
          borderRadius: 10,
          colorBgLayout: "#f5f6f8",
          fontFamily:
            "Helvetica, Arial, 'PingFang HK', 'PingFang SC', 'Microsoft JhengHei', sans-serif",
        },
        components: {
          Button: { fontWeight: 600 },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
