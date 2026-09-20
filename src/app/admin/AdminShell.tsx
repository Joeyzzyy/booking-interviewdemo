"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Layout, Tabs, Typography } from "antd";
import AdminTheme from "@/components/admin/AdminTheme";
import AdminBookings from "@/components/AdminBookings";
import AdminInterviews from "@/components/AdminInterviews";
import AdminInterviewRecords from "@/components/AdminInterviewRecords";

/**
 * 管理後台統一入口：訂單管理 / 視頻面試 / 面試記錄 tabs。
 * 演示項目，無密碼門禁。
 */
type Tab = "bookings" | "interview" | "records";

function AdminShellInner() {
  const params = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    ["interview", "records"].includes(initialTab || "") ? (initialTab as Tab) : "bookings"
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#e8f1fd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#2563eb",
            }}
          >
            B
          </div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            管理後台
          </Typography.Title>
        </div>
      </Layout.Header>
      <Layout.Content style={{ padding: "16px 24px 40px", maxWidth: 1280, width: "100%", margin: "0 auto" }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
          items={[
            { key: "bookings", label: "預約訂單管理", children: <AdminBookings /> },
            { key: "interview", label: "視頻面試", children: <AdminInterviews /> },
            { key: "records", label: "面試記錄", children: <AdminInterviewRecords /> },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}

export default function AdminShell() {
  return (
    <AdminTheme>
      <AdminShellInner />
    </AdminTheme>
  );
}
