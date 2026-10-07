"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useLanguage } from "@/lib/i18n";

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

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  approved: "green",
  rejected: "red",
};

/** 管理後台 — 用戶管理：查看全部註冊用戶，設置 / 取消管理員權限（管理員可置頂及刪除交流區任何帖子） */
export default function AdminUsers() {
  const { message } = App.useApp();
  const { t } = useLanguage();
  const tu = t.workspace.admin.users;
  const tp = t.workspace.admin.profiles;
  const tc = t.workspace.admin.common;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  /** 審核狀態顯示：未提交資料的用戶一律顯示「未提交」（profile_status 可能是 pending） */
  const statusTagOf = (u: AdminUser) => {
    if (!u.applicant_name) return <Tag>{tu.statusUnsubmitted}</Tag>;
    const key = u.profile_status || "pending";
    return <Tag color={STATUS_COLOR[key]}>{(tp.status as Record<string, string>)[key] || key}</Tag>;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc.loadFailed);
      setUsers(data.users);
    } catch (e) {
      message.error(e instanceof Error ? e.message : tc.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [message, tc]);

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
        message.error(data.error || tc.actFailed);
        return;
      }
      message.success(isAdmin ? tu.msgMadeAdmin : tu.msgRemovedAdmin);
      await load();
    } catch {
      message.error(tc.networkError);
    } finally {
      setActingId(null);
    }
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: tu.colApplicant,
      dataIndex: "applicant_name",
      width: 140,
      render: (v) => (v ? <strong>{v}</strong> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      title: tu.colCompany,
      dataIndex: "company_name",
      width: 200,
      render: (v) => v || "—",
    },
    {
      title: tu.colContact,
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
      title: tu.colRegisteredAt,
      dataIndex: "created_at",
      width: 160,
      render: (v) => (v ? new Date(v).toLocaleString("zh-HK") : "—"),
    },
    {
      title: tu.colReviewStatus,
      width: 100,
      render: (_, u) => statusTagOf(u),
    },
    {
      title: tu.colAdmin,
      width: 200,
      render: (_, u) => (
        <Space wrap>
          {u.is_admin && <Tag color="green">{tu.adminTag}</Tag>}
          <Popconfirm
            title={u.is_admin ? tu.confirmRemoveTitle : tu.confirmMakeTitle}
            description={u.is_admin ? tu.confirmRemoveDesc : tu.confirmMakeDesc}
            okText={tc.ok}
            cancelText={tc.cancel}
            onConfirm={() => void setAdmin(u, !u.is_admin)}
          >
            <Button size="small" danger={u.is_admin} loading={actingId === u.id}>
              {u.is_admin ? tu.removeAdmin : tu.makeAdmin}
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
          {tu.note}
        </Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          {tc.refresh}
        </Button>
      </Space>

      <Table<AdminUser>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={false}
        locale={{ emptyText: tc.empty }}
        scroll={{ x: 1000 }}
      />
    </>
  );
}
