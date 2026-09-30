"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Layout, Spin, Typography, App } from "antd";
import AdminTheme from "@/components/admin/AdminTheme";
import AdminBookings from "@/components/AdminBookings";

/**
 * 管理後台：僅預約訂單管理。
 * 視頻面試（題庫 / 發起 / 記錄）是前台功能，登入後於 /booking 使用，不在後台。
 * 密碼門禁：進入時校驗 /api/admin/me，未授權先顯示登入框（密碼見 ADMIN_PASSWORD 環境變量）。
 */
type AuthState = "checking" | "locked" | "authed";

function AdminShellInner() {
  const { modal } = App.useApp();
  const [auth, setAuth] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => alive && setAuth(r.ok ? "authed" : "locked"))
      .catch(() => alive && setAuth("locked"));
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async () => {
    if (!password.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        setPassword("");
        setAuth("authed");
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "密碼錯誤");
      }
    } catch {
      setError("登入失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }, [password]);

  const logout = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setAuth("locked");
  }, []);

  /** 登出前彈窗確認 */
  const confirmLogout = useCallback(() => {
    modal.confirm({
      title: "確認登出？",
      content: "登出後需要重新輸入管理密碼才能進入後台。",
      okText: "登出",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => void logout(),
    });
  }, [modal, logout]);

  if (auth === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (auth === "locked") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fb",
          padding: 16,
        }}
      >
        <Card style={{ width: 360, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg,#4cb896,#2a9470)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                color: "#fff",
              }}
            >
              N
            </div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              傭易做 管理後台
            </Typography.Title>
          </div>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 8 }}>
            請輸入管理密碼以繼續
          </Typography.Paragraph>
          <Input.Password
            placeholder="管理密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={login}
            autoFocus
          />
          {error ? (
            <Typography.Text type="danger" style={{ display: "block", marginTop: 8 }}>
              {error}
            </Typography.Text>
          ) : null}
          <Button
            type="primary"
            block
            style={{ marginTop: 16, background: "#35a07a" }}
            loading={submitting}
            onClick={login}
          >
            登入
          </Button>
        </Card>
      </div>
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
              borderRadius: 9,
              background: "linear-gradient(135deg,#4cb896,#2a9470)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#fff",
            }}
          >
            N
          </div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            傭易做 管理後台
          </Typography.Title>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: "#35a07a" }}>
            返回網站
          </Link>
          <Button size="small" onClick={confirmLogout}>
            登出
          </Button>
        </div>
      </Layout.Header>
      <Layout.Content style={{ padding: "16px 24px 40px", maxWidth: 1280, width: "100%", margin: "0 auto" }}>
        <Typography.Title level={5} style={{ marginTop: 8 }}>
          預約訂單管理
        </Typography.Title>
        <AdminBookings />
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
