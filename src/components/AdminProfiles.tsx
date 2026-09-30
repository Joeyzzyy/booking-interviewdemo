"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Modal, Space, Table, Tabs, Tag, Typography } from "antd";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface AdminProfile {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  applicant_name: string;
  company_name: string;
  labour_reg_no: string;
  id_card_url: string | null;
  profile_status: "pending" | "approved" | "rejected";
  profile_reject_reason: string | null;
  profile_submitted_at: string | null;
}

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pending: { color: "gold", label: "待審核" },
  approved: { color: "green", label: "已通過" },
  rejected: { color: "red", label: "未通過" },
};

/** 管理後台 — 註冊資料審核：通過後用戶才能使用功能；拒絕需填原因，用戶重填時可見 */
export default function AdminProfiles() {
  const { message } = App.useApp();
  const [status, setStatus] = useState("pending");
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(
    async (s: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/profiles?status=${s}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "讀取失敗");
        setProfiles(data.profiles);
      } catch (e) {
        message.error(e instanceof Error ? e.message : "讀取失敗");
      } finally {
        setLoading(false);
      }
    },
    [message]
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load(status);
  }, [load, status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const act = async (p: AdminProfile, action: "approve" | "reject", reason: string) => {
    setActingId(p.id);
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: p.id, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "操作失敗");
        return false;
      }
      message.success(action === "approve" ? "已通過，用戶下次進入即可使用功能" : "已拒絕，原因會顯示給用戶");
      await load(status);
      return true;
    } catch {
      message.error("網絡錯誤，操作失敗");
      return false;
    } finally {
      setActingId(null);
    }
  };

  const onReject = async () => {
    if (!rejectTarget) return;
    const ok = await act(rejectTarget, "reject", rejectReason);
    if (ok) {
      setRejectTarget(null);
      setRejectReason("");
    }
  };

  const columns: ColumnsType<AdminProfile> = [
    { title: "申請人", dataIndex: "applicant_name", width: 140, render: (v) => <strong>{v}</strong> },
    { title: "公司名稱", dataIndex: "company_name", width: 200 },
    { title: "勞工處登記編號", dataIndex: "labour_reg_no", width: 140 },
    {
      title: "聯絡方式",
      width: 200,
      render: (_, p) => (
        <span>
          {p.email || "—"}
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {p.phone || "—"}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: "身份證",
      width: 100,
      render: (_, p) =>
        p.id_card_url ? (
          <Button size="small" href={p.id_card_url} target="_blank">
            查看
          </Button>
        ) : (
          "—"
        ),
    },
    {
      title: "狀態",
      dataIndex: "profile_status",
      width: 90,
      render: (s) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label || s}</Tag>,
    },
    {
      title: "提交時間",
      dataIndex: "profile_submitted_at",
      width: 160,
      render: (v) => (v ? new Date(v).toLocaleString("zh-HK") : "—"),
    },
    {
      title: "操作",
      width: 200,
      render: (_, p) => (
        <Space wrap>
          {p.profile_status === "pending" && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                loading={actingId === p.id}
                onClick={() => void act(p, "approve", "")}
              >
                通過
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setRejectTarget(p);
                  setRejectReason("");
                }}
              >
                拒絕
              </Button>
            </>
          )}
          {p.profile_status === "rejected" && p.profile_reject_reason && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              原因：{p.profile_reject_reason}
            </Typography.Text>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Tabs
          activeKey={status}
          onChange={setStatus}
          items={[
            { key: "pending", label: "待審核" },
            { key: "approved", label: "已通過" },
            { key: "rejected", label: "未通過" },
            { key: "all", label: "全部" },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load(status)}>
          刷新
        </Button>
      </Space>

      <Table<AdminProfile>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={profiles}
        pagination={false}
        locale={{ emptyText: "暫時沒有記錄" }}
        scroll={{ x: 1100 }}
      />

      {/* 拒絕原因彈窗 */}
      <Modal
        open={rejectTarget !== null}
        title={`拒絕「${rejectTarget?.applicant_name}」的註冊資料？`}
        okText="確定拒絕"
        cancelText="返回"
        okButtonProps={{ danger: true, loading: actingId === rejectTarget?.id }}
        onOk={() => void onReject()}
        onCancel={() => setRejectTarget(null)}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          請填寫拒絕原因（必填）。用戶下次進入時會在表單頂部看到此原因，並可重新填寫提交。
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="例如：身份證照片模糊，請重新上傳清晰照片"
        />
      </Modal>
    </>
  );
}
