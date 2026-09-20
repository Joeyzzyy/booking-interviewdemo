"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Input, Layout, Popconfirm, Tabs, Typography } from "antd";
import { LogoutOutlined, LockOutlined } from "@ant-design/icons";
import AdminTheme from "@/components/admin/AdminTheme";
import AdminBookings from "@/components/AdminBookings";
import AdminInterviews from "@/components/AdminInterviews";
import AdminInterviewRecords from "@/components/AdminInterviewRecords";

const SESSION_KEY = "admin_pwd";

/**
 * 管理後台統一入口：密碼門禁 + 訂單管理 / 視頻面試 / 流量數據 tabs。
 * 密碼經 /api/admin/bookings 服務端校驗（ADMIN_PASSWORD）。
 */
type Tab = "bookings" | "interview" | "records";

function AdminShellInner() {
  const params = useSearchParams();
  const [password, setPassword] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    ["interview", "records"].includes(initialTab || "") ? (initialTab as Tab) : "bookings"
  );

  const verify = async (pwd: string): Promise<boolean> => {
    const res = await fetch("/api/admin/bookings?status=pending", {
      headers: { "x-admin-auth": pwd },
    });
    return res.status !== 401;
  };

  const login = async () => {
    if (!input) return;
    setError("");
    setChecking(true);
    try {
      const ok = await verify(input);
      if (ok) {
        sessionStorage.setItem(SESSION_KEY, input);
        setPassword(input);
      } else {
        setError("密碼錯誤");
        setInput("");
      }
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setChecking(false);
    }
  };

  // 刷新頁面後保持登入（sessionStorage）
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return;
    void (async () => {
      if (await verify(saved)) {
        setPassword(saved);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    })();
  }, []);

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setPassword(null);
  };

  if (!password) {
    return (
      <Layout style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card style={{ width: 380, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 12px",
                borderRadius: 14,
                background: "#ffde59",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                color: "#2d3339",
              }}
            >
              <LockOutlined />
            </div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              管理後台
            </Typography.Title>
            <Typography.Text type="secondary">家壹僱傭中心</Typography.Text>
          </div>
          <Input.Password
            size="large"
            placeholder="管理員密碼"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={login}
            status={error ? "error" : ""}
            autoFocus
          />
          {error && (
            <Typography.Text type="danger" style={{ display: "block", marginTop: 8 }}>
              {error}
            </Typography.Text>
          )}
          <Button
            type="primary"
            size="large"
            block
            loading={checking}
            onClick={login}
            style={{ marginTop: 16 }}
          >
            登入
          </Button>
        </Card>
      </Layout>
    );
  }

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
              background: "#ffde59",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#2d3339",
            }}
          >
            壹
          </div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            管理後台
          </Typography.Title>
        </div>
        <Popconfirm
          title="確定登出？"
          okText="登出"
          cancelText="取消"
          onConfirm={logout}
        >
          <Button icon={<LogoutOutlined />}>登出</Button>
        </Popconfirm>
      </Layout.Header>
      <Layout.Content style={{ padding: "16px 24px 40px", maxWidth: 1280, width: "100%", margin: "0 auto" }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
          items={[
            { key: "bookings", label: "預約訂單管理", children: <AdminBookings password={password} /> },
            { key: "interview", label: "視頻面試", children: <AdminInterviews password={password} /> },
            { key: "records", label: "面試記錄", children: <AdminInterviewRecords password={password} /> },
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
