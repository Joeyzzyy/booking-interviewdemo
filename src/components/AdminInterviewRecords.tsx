"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Card, List, Space, Table, Tag, Typography } from "antd";
import { CopyOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import VideoWithCover from "@/components/common/VideoWithCover";
import { useLanguage } from "@/lib/i18n";

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

const STATUS_COLOR: Record<string, string> = {
  pending: "default",
  in_progress: "gold",
  completed: "green",
};

/** 面試記錄（獨立 tab）：列表 + 展開詳情（報告/作答/視頻）+ 整場刪除 */
export default function AdminInterviewRecords({ apiBase = "/api/admin" }: { apiBase?: string }) {
  const { message, modal } = App.useApp();
  const { t } = useLanguage();
  const tr = t.workspace.interviewMgmt.records;
  const tm = t.workspace.interviewMgmt;
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<string, { interview: { resume_text: string | null; resume_url: string | null; report: Report | null }; answers: Answer[] } | null>
  >({});
  // 詳情默認展開：載入後自動展開全部行
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/interviews`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tm.loadFailed);
      setInterviews(data.interviews || []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : tm.loadFailed);
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
    message.success(tr.copied);
  };

  const deleteInterview = (iv: InterviewItem) => {
    modal.confirm({
      title: tr.deleteTitle,
      content: tr.deleteBody(iv.worker_name),
      okText: tr.deleteOk,
      okButtonProps: { danger: true, loading: deletingId === iv.id },
      cancelText: tm.cancel,
      onOk: async () => {
        setDeletingId(iv.id);
        try {
          const res = await fetch(`${apiBase}/interviews/${iv.id}`, { method: "DELETE" });
          if (res.ok) {
            message.success(tr.deleted);
            await load();
          } else {
            message.error((await res.json()).error || tr.deleteFailed);
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
      const res = await fetch(`${apiBase}/interviews/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${tm.loadFailed}（${res.status}）`);
      setDetails((prev) => ({ ...prev, [id]: data }));
    } catch (e) {
      // 記錄失敗狀態，避免展開行永遠停留喺「載入中…」
      setDetails((prev) => ({ ...prev, [id]: null }));
      message.error(e instanceof Error ? e.message : tr.detailLoadFailed);
    }
  };

  // 默認展開所有詳情：列表載入後自動展開並逐條載入詳情
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    setExpandedKeys(interviews.map((i) => i.id));
    interviews.forEach((i) => void loadDetail(i.id, true));
  }, [interviews]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const columns: ColumnsType<InterviewItem> = [
    { title: tr.colWorker, dataIndex: "worker_name", width: 150, render: (v) => <strong>{v}</strong> },
    {
      title: tr.colStatus,
      dataIndex: "status",
      width: 100,
      render: (s) => (
        <Tag color={STATUS_COLOR[s]}>
          {(tr.status as Record<string, string>)[s] || s}
        </Tag>
      ),
    },
    {
      title: tr.colScore,
      width: 90,
      render: (_, iv) => (iv.report?.score != null ? <Tag color="blue">{iv.report.score}/10</Tag> : "—"),
    },
    {
      title: tr.colCreatedAt,
      dataIndex: "created_at",
      width: 170,
      render: (v) => new Date(v).toLocaleString("zh-HK"),
    },
    {
      title: tr.colActions,
      width: 200,
      render: (_, iv) => (
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyLink(iv.token)}>
            {tr.copyLink}
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === iv.id}
            onClick={() => deleteInterview(iv)}
          >
            {tr.delete}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>{tm.refresh}</Button>}
    >
      <Table<InterviewItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={interviews}
        scroll={{ x: true }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: tr.empty }}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys([...keys] as string[]),
          onExpand: (expanded, record) => loadDetail(record.id, expanded),
          expandedRowRender: (iv) => {
            const d = details[iv.id];
            if (iv.id in details && !d)
              return <Typography.Text type="danger">{tr.detailFailed}</Typography.Text>;
            if (!d) return <Typography.Text type="secondary">{tr.loading}</Typography.Text>;
            const r = d.interview.report;
            return (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {d.interview.resume_url && (
                  <Button size="small" href={d.interview.resume_url} target="_blank">
                    {tr.downloadResume}
                  </Button>
                )}
                {r && (
                  <Card size="small" title={tr.reportTitle(r.score)} style={{ background: "#fffbe6" }}>
                    <Typography.Paragraph>{r.summary}</Typography.Paragraph>
                    {r.strengths?.length > 0 && (
                      <>
                        <strong>{tr.strengths}</strong>
                        <ul>{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </>
                    )}
                    {r.concerns?.length > 0 && (
                      <>
                        <strong>{tr.concerns}</strong>
                        <ul>{r.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </>
                    )}
                    {r.resumeMatch && <p><strong>{tr.resumeMatch}</strong>{r.resumeMatch}</p>}
                    {r.recommendation && <p><strong>{tr.recommendation}</strong>{r.recommendation}</p>}
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
                              {tr.attempt(a.attempt)} · {a.passed ? tr.passed : tr.failed}
                            </Tag>
                          </Space>
                          {a.transcript && (
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                              {a.transcript}
                            </Typography.Paragraph>
                          )}
                          {a.feedback && (
                            <Typography.Text type="danger">{tr.aiFeedback(a.feedback)}</Typography.Text>
                          )}
                          {a.video_url && (
                            <VideoWithCover src={a.video_url} controls preload="metadata" style={{ width: "100%", maxWidth: 480, borderRadius: 8, background: "#000" }} />
                          )}
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Typography.Text type="secondary">{tr.noAnswers}</Typography.Text>
                )}
              </Space>
            );
          },
        }}
      />
    </Card>
  );
}
