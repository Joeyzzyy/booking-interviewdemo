"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Modal, Space, Table, Tabs, Tag, Typography } from "antd";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useLanguage } from "@/lib/i18n";

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

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  approved: "green",
  rejected: "red",
};

/** 管理後台 — 註冊資料審核：通過後用戶才能使用功能；拒絕需填原因，用戶重填時可見 */
export default function AdminProfiles() {
  const { message } = App.useApp();
  const { t } = useLanguage();
  const tp = t.workspace.admin.profiles;
  const tc = t.workspace.admin.common;
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
        if (!res.ok) throw new Error(data.error || tc.loadFailed);
        setProfiles(data.profiles);
      } catch (e) {
        message.error(e instanceof Error ? e.message : tc.loadFailed);
      } finally {
        setLoading(false);
      }
    },
    [message, tc]
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
        message.error(data.error || tc.actFailed);
        return false;
      }
      message.success(
        action === "approve"
          ? `${tp.msgApproved}${data.emailSent ? tc.emailSentSuffix : ""}`
          : `${tp.msgRejected}${data.emailSent ? tc.emailSentSuffix : ""}${tp.rejectReasonShown}`
      );
      await load(status);
      return true;
    } catch {
      message.error(tc.networkError);
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
    { title: tp.colApplicant, dataIndex: "applicant_name", width: 140, render: (v) => <strong>{v}</strong> },
    { title: tp.colCompany, dataIndex: "company_name", width: 200 },
    { title: tp.colLabourNo, dataIndex: "labour_reg_no", width: 140 },
    {
      title: tp.colContact,
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
      title: tp.colIdCard,
      width: 100,
      render: (_, p) =>
        p.id_card_url ? (
          <Button size="small" href={p.id_card_url} target="_blank">
            {tp.view}
          </Button>
        ) : (
          "—"
        ),
    },
    {
      title: tp.colStatus,
      dataIndex: "profile_status",
      width: 90,
      render: (s) => (
        <Tag color={STATUS_COLOR[s]}>
          {(tp.status as Record<string, string>)[s] || s}
        </Tag>
      ),
    },
    {
      title: tp.colSubmittedAt,
      dataIndex: "profile_submitted_at",
      width: 160,
      render: (v) => (v ? new Date(v).toLocaleString("zh-HK") : "—"),
    },
    {
      title: tp.colActions,
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
                {tp.approve}
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
                {tp.reject}
              </Button>
            </>
          )}
          {p.profile_status === "rejected" && p.profile_reject_reason && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {tp.reasonPrefix}{p.profile_reject_reason}
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
            { key: "pending", label: tp.tabs.pending },
            { key: "approved", label: tp.tabs.approved },
            { key: "rejected", label: tp.tabs.rejected },
            { key: "all", label: tp.tabs.all },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load(status)}>
          {tc.refresh}
        </Button>
      </Space>

      <Table<AdminProfile>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={profiles}
        pagination={false}
        locale={{ emptyText: tc.empty }}
        scroll={{ x: 1100 }}
      />

      {/* 拒絕原因彈窗 */}
      <Modal
        open={rejectTarget !== null}
        title={tp.rejectTitle(rejectTarget?.applicant_name || "")}
        okText={tp.rejectOk}
        cancelText={tc.back}
        okButtonProps={{ danger: true, loading: actingId === rejectTarget?.id }}
        onOk={() => void onReject()}
        onCancel={() => setRejectTarget(null)}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          {tp.rejectHint}
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={tp.rejectPlaceholder}
        />
      </Modal>
    </>
  );
}
