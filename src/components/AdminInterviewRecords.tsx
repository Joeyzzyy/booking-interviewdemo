"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Card, List, Space, Table, Tag, Typography } from "antd";
import { CopyOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface InterviewItem {
  id: string;
  token: string;
  worker_name: string;
  status: "pending" | "in_progress" | "completed";
  report: { score?: number; summary?: string } | null;
  created_at: string;
}

interface Answer {
  id: string;
  question_text: string;
  attempt: number;
  video_url: string | null;
  transcript: string | null;
  passed: boolean | null;
  feedback: string | null;
}

interface Report {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  resumeMatch: string;
  recommendation: string;
  generatedBy: "ai" | "none";
}

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  pending: { color: "default", label: "未開始" },
  in_progress: { color: "gold", label: "進行中" },
  completed: { color: "green", label: "已完成" },
};

/** 面試記錄（獨立 tab）：列表 + 展開詳情（報告/作答/視頻）+ 整場刪除 */
export default function AdminInterviewRecords() {
  const { message, modal } = App.useApp();
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<string, { interview: { resume_text: string | null; resume_url: string | null; report: Report | null }; answers: Answer[] }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/interviews");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setInterviews(data.interviews || []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/interview/${token}`).catch(() => {});
    message.success("連結已複製");
  };

  const deleteInterview = (iv: InterviewItem) => {
    modal.confirm({
      title: "刪除面試記錄？",
      content: `確定刪除「${iv.worker_name}」嘅整場面試？作答記錄、視頻及簡歷原件會一併刪除，不能恢復。`,
      okText: "確定刪除",
      okButtonProps: { danger: true, loading: deletingId === iv.id },
      cancelText: "取消",
      onOk: async () => {
        setDeletingId(iv.id);
        try {
          const res = await fetch(`/api/admin/interviews/${iv.id}`, { method: "DELETE" });
          if (res.ok) {
            message.success("已刪除");
            await load();
          } else {
            message.error((await res.json()).error || "刪除失敗");
          }
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const loadDetail = async (id: string, expanded: boolean) => {
    if (!expanded || details[id]) return;
    try {
      const res = await fetch(`/api/admin/interviews/${id}`);
      const data = await res.json();
      if (res.ok) setDetails((prev) => ({ ...prev, [id]: data }));
    } catch {
      message.error("詳情載入失敗");
    }
  };

  const columns: ColumnsType<InterviewItem> = [
    { title: "工人", dataIndex: "worker_name", width: 150, render: (v) => <strong>{v}</strong> },
    {
      title: "狀態",
      dataIndex: "status",
      width: 100,
      render: (s) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label || s}</Tag>,
    },
    {
      title: "評分",
      width: 90,
      render: (_, iv) => (iv.report?.score != null ? <Tag color="blue">{iv.report.score}/10</Tag> : "—"),
    },
    {
      title: "創建時間",
      dataIndex: "created_at",
      width: 170,
      render: (v) => new Date(v).toLocaleString("zh-HK"),
    },
    {
      title: "操作",
      width: 200,
      render: (_, iv) => (
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyLink(iv.token)}>
            複製連結
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === iv.id}
            onClick={() => deleteInterview(iv)}
          >
            刪除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>刷新</Button>}
    >
      <Table<InterviewItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={interviews}
        scroll={{ x: true }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: "暫無面試記錄" }}
        expandable={{
          onExpand: (expanded, record) => loadDetail(record.id, expanded),
          expandedRowRender: (iv) => {
            const d = details[iv.id];
            if (!d) return <Typography.Text type="secondary">載入中…</Typography.Text>;
            const r = d.interview.report;
            return (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {d.interview.resume_url && (
                  <Button size="small" href={d.interview.resume_url} target="_blank">
                    下載簡歷原件
                  </Button>
                )}
                {r && (
                  <Card size="small" title={`AI 匹配報告（${r.score}/10 分）`} style={{ background: "#fffbe6" }}>
                    <Typography.Paragraph>{r.summary}</Typography.Paragraph>
                    {r.strengths?.length > 0 && (
                      <>
                        <strong>優點：</strong>
                        <ul>{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </>
                    )}
                    {r.concerns?.length > 0 && (
                      <>
                        <strong>疑點：</strong>
                        <ul>{r.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </>
                    )}
                    {r.resumeMatch && <p><strong>簡歷匹配：</strong>{r.resumeMatch}</p>}
                    {r.recommendation && <p><strong>建議：</strong>{r.recommendation}</p>}
                  </Card>
                )}
                {d.answers.length > 0 ? (
                  <List
                    dataSource={d.answers}
                    renderItem={(a) => (
                      <List.Item>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Space>
                            <strong>{a.question_text}</strong>
                            <Tag color={a.passed ? "green" : "red"}>
                              第 {a.attempt} 次 · {a.passed ? "通過" : "未通過"}
                            </Tag>
                          </Space>
                          {a.transcript && (
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                              {a.transcript}
                            </Typography.Paragraph>
                          )}
                          {a.feedback && (
                            <Typography.Text type="danger">AI 反饋：{a.feedback}</Typography.Text>
                          )}
                          {a.video_url && (
                            <video src={a.video_url} controls preload="metadata" style={{ width: "100%", maxWidth: 480, borderRadius: 8, background: "#000" }} />
                          )}
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Typography.Text type="secondary">尚未作答。</Typography.Text>
                )}
              </Space>
            );
          },
        }}
      />
    </Card>
  );
}
