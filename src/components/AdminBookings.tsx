"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useLanguage } from "@/lib/i18n";

interface BookingFile {
  name: string;
  path: string;
  size: number;
  url: string | null;
}

interface AdminBooking {
  id: string;
  order_no: string;
  service_label: string;
  price_hkd: number | null;
  employer_name: string;
  phone: string;
  whatsapp: string | null;
  email: string;
  worker_name: string;
  details: Record<string, string>;
  remark: string | null;
  files: BookingFile[];
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  payment_status: string;
  admin_note: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  confirmed: "green",
  rejected: "red",
  cancelled: "default",
};

/** 電話規範化為 wa.me 國際格式（香港 8 位自動補 852） */
function waNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 8) return `852${digits}`;
  return digits;
}

function waLink(b: AdminBooking, waText: string): string | null {
  const num = waNumber(b.whatsapp) || waNumber(b.phone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(waText)}`;
}

export default function AdminBookings() {
  const { message } = App.useApp();
  const { t } = useLanguage();
  const tb = t.workspace.admin.bookings;
  const tc = t.workspace.admin.common;
  const [status, setStatus] = useState("pending");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminBooking | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<AdminBooking | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  // 詳情默認展開：載入後自動展開全部行
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const load = useCallback(
    async (s: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/bookings?status=${s}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc.loadFailed);
        setBookings(data.bookings);
        setExpandedKeys((data.bookings as AdminBooking[]).map((b) => b.id));
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

  const act = async (b: AdminBooking, action: "confirm" | "reject", note: string) => {
    setActingId(b.id);
    try {
      const res = await fetch(`/api/admin/bookings/${b.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || tc.actFailed);
        return false;
      }
      message.success(
        `${action === "confirm" ? tb.msgConfirmed : tb.msgRejected}${data.emailSent ? tc.emailSentSuffix : ""}`
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

  const onConfirm = (b: AdminBooking) => {
    setConfirmTarget(b);
    setConfirmNote("");
  };

  const doConfirm = async () => {
    if (!confirmTarget) return;
    const ok = await act(confirmTarget, "confirm", confirmNote);
    if (ok) {
      setConfirmTarget(null);
      setConfirmNote("");
    }
  };

  const onReject = async () => {
    if (!rejectTarget) return;
    const ok = await act(rejectTarget, "reject", rejectNote);
    if (ok) {
      setRejectTarget(null);
      setRejectNote("");
    }
  };

  const columns: ColumnsType<AdminBooking> = [
    { title: tb.colOrderNo, dataIndex: "order_no", width: 170, render: (v) => <strong>{v}</strong> },
    { title: tb.colService, dataIndex: "service_label", width: 120 },
    {
      title: tb.colEmployer,
      width: 200,
      render: (_, b) => (
        <span>
          {b.employer_name}
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {b.phone}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: tb.colStatus,
      dataIndex: "status",
      width: 100,
      render: (s) => (
        <Tag color={STATUS_COLOR[s]}>
          {(tb.status as Record<string, string>)[s] || s}
        </Tag>
      ),
    },
    {
      title: tb.colCreatedAt,
      dataIndex: "created_at",
      width: 170,
      render: (v) => new Date(v).toLocaleString("zh-HK"),
    },
    {
      title: tb.colActions,
      width: 360,
      render: (_, b) => {
        const wa = waLink(b, tb.waText(b.employer_name, b.order_no, b.service_label));
        return (
        <Space wrap>
          {wa && (
            <Button
              size="small"
              icon={<WhatsAppOutlined />}
              href={wa}
              target="_blank"
              style={{ background: "#25d366", color: "#fff", border: "none" }}
            >
              {tb.whatsappBtn}
            </Button>
          )}
          {b.status === "pending" && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                loading={actingId === b.id}
                onClick={() => onConfirm(b)}
              >
                {tb.confirmBtn}
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setRejectTarget(b);
                  setRejectNote("");
                }}
              >
                {tb.rejectBtn}
              </Button>
            </>
          )}
        </Space>
        );
      },
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Tabs
          activeKey={status}
          onChange={setStatus}
          items={[
            { key: "pending", label: tb.tabs.pending },
            { key: "confirmed", label: tb.tabs.confirmed },
            { key: "rejected", label: tb.tabs.rejected },
            { key: "all", label: tb.tabs.all },
          ]}
        />
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(status)}>
          {tc.refresh}
        </Button>
      </Space>

      <Table<AdminBooking>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={bookings}
        scroll={{ x: true }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: tb.empty }}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys([...keys] as string[]),
          expandedRowRender: (b) => (
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label={tb.detailWorkerName}>{b.worker_name}</Descriptions.Item>
              <Descriptions.Item label={tb.detailEmail}>{b.email}</Descriptions.Item>
              {b.whatsapp && <Descriptions.Item label="WhatsApp">{b.whatsapp}</Descriptions.Item>}
              <Descriptions.Item label={tb.detailPrice}>
                {b.price_hkd != null ? `HK$${b.price_hkd}` : tb.priceTbd}
              </Descriptions.Item>
              {Object.entries(b.details || {}).map(([k, v]) => (
                <Descriptions.Item key={k} label={k}>
                  {v}
                </Descriptions.Item>
              ))}
              {b.remark && <Descriptions.Item label={tb.detailRemark}>{b.remark}</Descriptions.Item>}
              {b.admin_note && (
                <Descriptions.Item label={tb.detailAdminNote}>{b.admin_note}</Descriptions.Item>
              )}
              {b.files.length > 0 && (
                <Descriptions.Item label={tb.detailFiles}>
                  <Space wrap>
                    {b.files.map((f) => (
                      <Button key={f.path} size="small" href={f.url || "#"} target="_blank">
                        {f.name}
                      </Button>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          ),
        }}
      />

      {/* 拒絕理由彈窗（必填，客戶可見） */}
      <Modal
        title={tb.rejectTitle(rejectTarget?.order_no || "")}
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={onReject}
        okText={tb.rejectOk}
        cancelText={tc.back}
        okButtonProps={{ danger: true, loading: actingId === rejectTarget?.id, disabled: !rejectNote.trim() }}
      >
        <Typography.Paragraph type="secondary">
          {tb.rejectHint}
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder={tb.rejectPlaceholder}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>

      {/* 確認訂單彈窗（可寫備忘，客戶可見） */}
      <Modal
        title={tb.confirmTitle(confirmTarget?.order_no || "")}
        open={!!confirmTarget}
        onCancel={() => setConfirmTarget(null)}
        onOk={doConfirm}
        okText={tb.confirmOk}
        cancelText={tc.back}
        okButtonProps={{ loading: actingId === confirmTarget?.id }}
      >
        <Typography.Paragraph type="secondary">
          {tb.confirmHint}
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder={tb.confirmPlaceholder}
          value={confirmNote}
          onChange={(e) => setConfirmNote(e.target.value)}
        />
      </Modal>
    </>
  );
}
