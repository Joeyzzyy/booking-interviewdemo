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

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pending: { color: "gold", label: "待確認" },
  confirmed: { color: "green", label: "已確認" },
  rejected: { color: "red", label: "已拒絕" },
  cancelled: { color: "default", label: "已取消" },
};

/** 電話規範化為 wa.me 國際格式（香港 8 位自動補 852） */
function waNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 8) return `852${digits}`;
  return digits;
}

function waLink(b: AdminBooking): string | null {
  const num = waNumber(b.whatsapp) || waNumber(b.phone);
  if (!num) return null;
  const text = `你好 ${b.employer_name}，呢度係家壹僱傭中心。關於你嘅預約 ${b.order_no}（${b.service_label}）：`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export default function AdminBookings({ password }: { password: string }) {
  const { message, modal } = App.useApp();
  const [status, setStatus] = useState("pending");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminBooking | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(
    async (s: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/bookings?status=${s}`, {
          headers: { "x-admin-auth": password },
        });
        if (res.status === 401) {
          message.error("登入已過期，請重新登入");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "讀取失敗");
        setBookings(data.bookings);
      } catch (e) {
        message.error(e instanceof Error ? e.message : "讀取失敗");
      } finally {
        setLoading(false);
      }
    },
    [password, message]
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
        headers: { "Content-Type": "application/json", "x-admin-auth": password },
        body: JSON.stringify({ action, adminNote: note }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "操作失敗");
        return false;
      }
      message.success(
        `${action === "confirm" ? "已確認" : "已拒絕"}${data.emailSent ? "，通知郵件已發送" : ""}`
      );
      await load(status);
      return true;
    } catch {
      message.error("網絡錯誤，操作失敗");
      return false;
    } finally {
      setActingId(null);
    }
  };

  const onConfirm = (b: AdminBooking) => {
    modal.confirm({
      title: "確認訂單？",
      content: `${b.order_no}（${b.service_label}）— 確認後會以電郵通知客戶。`,
      okText: "確認訂單",
      cancelText: "取消",
      okButtonProps: { loading: actingId === b.id },
      onOk: () => act(b, "confirm", ""),
    });
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
    { title: "訂單號", dataIndex: "order_no", width: 170, render: (v) => <strong>{v}</strong> },
    { title: "服務", dataIndex: "service_label", width: 120 },
    {
      title: "僱主",
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
      title: "狀態",
      dataIndex: "status",
      width: 100,
      render: (s) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label || s}</Tag>,
    },
    {
      title: "下單時間",
      dataIndex: "created_at",
      width: 170,
      render: (v) => new Date(v).toLocaleString("zh-HK"),
    },
    {
      title: "操作",
      width: 220,
      render: (_, b) => (
        <Space wrap>
          {waLink(b) && (
            <Button
              size="small"
              icon={<WhatsAppOutlined />}
              href={waLink(b)!}
              target="_blank"
              style={{ background: "#25d366", color: "#fff", border: "none" }}
            >
              WhatsApp
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
                確認
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
                拒絕
              </Button>
            </>
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
            { key: "pending", label: "待確認" },
            { key: "confirmed", label: "已確認" },
            { key: "rejected", label: "已拒絕" },
            { key: "all", label: "全部" },
          ]}
        />
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(status)}>
          刷新
        </Button>
      </Space>

      <Table<AdminBooking>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={bookings}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: "暫無訂單" }}
        expandable={{
          expandedRowRender: (b) => (
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="工人姓名">{b.worker_name}</Descriptions.Item>
              <Descriptions.Item label="電郵">{b.email}</Descriptions.Item>
              {b.whatsapp && <Descriptions.Item label="WhatsApp">{b.whatsapp}</Descriptions.Item>}
              <Descriptions.Item label="收費">
                {b.price_hkd != null ? `HK$${b.price_hkd}` : "面議"}
              </Descriptions.Item>
              {Object.entries(b.details || {}).map(([k, v]) => (
                <Descriptions.Item key={k} label={k}>
                  {v}
                </Descriptions.Item>
              ))}
              {b.remark && <Descriptions.Item label="備註">{b.remark}</Descriptions.Item>}
              {b.admin_note && (
                <Descriptions.Item label="管理員備註">{b.admin_note}</Descriptions.Item>
              )}
              {b.files.length > 0 && (
                <Descriptions.Item label="上傳文件">
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

      {/* 拒絕原因彈窗（自研 antd Modal，唔用瀏覽器原生） */}
      <Modal
        title={`拒絕訂單 ${rejectTarget?.order_no || ""}`}
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={onReject}
        okText="確定拒絕"
        cancelText="返回"
        okButtonProps={{ danger: true, loading: actingId === rejectTarget?.id }}
      >
        <Typography.Paragraph type="secondary">
          拒絕原因會以電郵通知客戶，套票會自動退回客戶賬戶。
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder="拒絕原因（選填）"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </>
  );
}
