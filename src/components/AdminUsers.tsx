"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  applicant_name: string | null;
  company_name: string | null;
  profile_status: "pending" | "approved" | "rejected" | null;
  is_admin: boolean;
  created_at: string;
}

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pending: { color: "gold", label: "待審核" },
  approved: { color: "green", label: "已通過" },
  rejected: { color: "red", label: "未通過" },
};

/** 審核狀態顯示：未提交資料的用戶一律顯示「未提交」（profile_status 可能是 pending） */
function statusTagOf(u: AdminUser) {
  if (!u.applicant_name) return <Tag>未提交</Tag>;
  const st = STATUS_TAG[u.profile_status || "pending"];
  return <Tag color={st?.color}>{st?.label || u.profile_status}</Tag>;
}

/** 管理後台 — 用戶管理：查看全部註冊用戶，設置 / 取消管理員權限（管理員可置頂及刪除交流區任何帖子） */
export default function AdminUsers() {
  const { message } = App.useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setUsers(data.users);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [message]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setAdmin = async (u: AdminUser, isAdmin: boolean) => {
    setActingId(u.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: u.id, isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "操作失敗");
        return;
      }
      message.success(isAdmin ? "已設為管理員" : "已取消管理員權限");
      await load();
    } catch {
      message.error("網絡錯誤，操作失敗");
    } finally {
      setActingId(null);
    }
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: "申請人",
      dataIndex: "applicant_name",
      width: 140,
      render: (v) => (v ? <strong>{v}</strong> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      title: "公司名稱",
      dataIndex: "company_name",
      width: 200,
      render: (v) => v || "—",
    },
    {
      title: "聯絡方式",
      width: 220,
      render: (_, u) => (
        <span>
          {u.email || "—"}
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {u.phone || "—"}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: "註冊時間",
      dataIndex: "created_at",
      width: 160,
      render: (v) => (v ? new Date(v).toLocaleString("zh-HK") : "—"),
    },
    {
      title: "審核狀態",
      width: 100,
      render: (_, u) => statusTagOf(u),
    },
    {
      title: "管理員",
      width: 200,
      render: (_, u) => (
        <Space wrap>
          {u.is_admin && <Tag color="green">管理員</Tag>}
          <Popconfirm
            title={u.is_admin ? "取消此用戶的管理員權限？" : "將此用戶設為管理員？"}
            description={u.is_admin ? "取消後不能再置頂 / 刪除其他用戶的帖子。" : "管理員可以置頂及刪除交流區任何帖子。"}
            okText="確定"
            cancelText="取消"
            onConfirm={() => void setAdmin(u, !u.is_admin)}
          >
            <Button size="small" danger={u.is_admin} loading={actingId === u.id}>
              {u.is_admin ? "取消管理員" : "設為管理員"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          全部註冊用戶（最多顯示 300 個）。管理員可喺資訊交流區置頂 / 刪除任何帖子。
        </Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          刷新
        </Button>
      </Space>

      <Table<AdminUser>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={false}
        locale={{ emptyText: "暫時沒有記錄" }}
        scroll={{ x: 1000 }}
      />
    </>
  );
}
