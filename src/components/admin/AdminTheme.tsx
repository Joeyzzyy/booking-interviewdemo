"use client";

import { App, ConfigProvider, theme } from "antd";
import zhHK from "antd/locale/zh_HK";

/**
 * 管理後台 antd 主題：NEXUSLINK 品牌靛藍系（#35a07a 主色）。
 * antd App 組件提供 message / modal 上下文（所有提示與彈窗走這套，不用瀏覽器原生）。
 */
export default function AdminTheme({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhHK}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#35a07a",
          colorInfo: "#35a07a",
          colorLink: "#2a8163",
          borderRadius: 10,
          colorBgLayout: "#f6f7fc",
          fontFamily:
            "'Helvetica Neue', Helvetica, Arial, 'PingFang HK', 'PingFang SC', 'Microsoft JhengHei', sans-serif",
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
