"use client";

import { App, ConfigProvider, theme } from "antd";
import zhHK from "antd/locale/zh_HK";

/**
 * 管理後台 antd 主題：沿用品牌黃色系（#e6b800 主色，淺黃 #ffde59 太淺不適合做按鈕主色）。
 * antd App 組件提供 message / modal 上下文（所有提示與彈窗走這套，不用瀏覽器原生）。
 */
export default function AdminTheme({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhHK}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#e6b800",
          colorInfo: "#e6b800",
          colorLink: "#b47700",
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
