"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App, Button, Card, List, Space, Table, Tag, Typography } from "antd";
import { CopyOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import VideoWithCover from "@/components/common/VideoWithCover";
import { useLanguage } from "@/lib/i18n";

interface InterviewItem {
  id: string;
  token: string;
  worker_name: string;
  status: "pending" | "in_progress" | "processing" | "completed";
  report: { score?: number; summary?: string } | null;
  created_at: string;
}

interface Answer {
  id: string;
  question_text: string;
  attempt: number;
  video_path?: string | null;
  video_url: string | null;
  audio_url?: string | null;
  video_start?: number | null;
  video_end?: number | null;
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

/** Advanced（自製 CV）生成的結構化 CV */
interface WorkerCv {
  fullName: string;
  summary: string;
  basicInfo: { label: string; value: string }[];
  languages: string[];
  workExperience: string[];
  skills: string[];
  careExperience: { label: string; value: string }[];
  education: string;
  availability: string;
  additionalNotes: string;
}

/** CV → 純文本（下載用） */
function cvToText(cv: WorkerCv, sectionTitles: Record<string, string>): string {
  const lines: string[] = [cv.fullName, "=".repeat(cv.fullName.length), ""];
  if (cv.summary) lines.push(cv.summary, "");
  if (cv.basicInfo.length > 0) {
    lines.push(sectionTitles.basicInfo, "-".repeat(20));
    for (const p of cv.basicInfo) lines.push(`${p.label}：${p.value}`);
    lines.push("");
  }
  if (cv.languages.length > 0) lines.push(sectionTitles.languages, cv.languages.join("、"), "");
  if (cv.workExperience.length > 0) {
    lines.push(sectionTitles.workExperience, "-".repeat(20));
    for (const w of cv.workExperience) lines.push(`・${w}`);
    lines.push("");
  }
  if (cv.skills.length > 0) lines.push(sectionTitles.skills, cv.skills.join("、"), "");
  if (cv.careExperience.length > 0) {
    lines.push(sectionTitles.careExperience, "-".repeat(20));
    for (const p of cv.careExperience) lines.push(`${p.label}：${p.value}`);
    lines.push("");
  }
  if (cv.education) lines.push(sectionTitles.education, cv.education, "");
  if (cv.availability) lines.push(sectionTitles.availability, cv.availability, "");
  if (cv.additionalNotes) lines.push(sectionTitles.additionalNotes, cv.additionalNotes, "");
  return lines.join("\n");
}

const STATUS_COLOR: Record<string, string> = {
  pending: "default",
  in_progress: "gold",
  processing: "processing",
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
    Record<string, { interview: { resume_text: string | null; resume_url: string | null; report: Report | null; plan?: string | null; cv?: WorkerCv | null }; answers: Answer[] } | null>
  >({});
  // 詳情默認展開：載入後自動展開全部行
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  /** 頂部整場視頻播放器 ref：逐題秒數點擊跳轉用 */
  const sessionVideoRef = useRef<HTMLVideoElement | null>(null);

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
            // 整場連續錄製：全部作答共用同一個視頻文件 → 只在頂部展示一次，逐題僅顯示轉錄
            //（舊流程逐題錄製的歷史數據 video_path 各不相同 → 保持逐題掛視頻原樣）
            const videoPaths = [...new Set((d.answers || []).map((a) => a.video_path).filter(Boolean))];
            const isSessionRecording = videoPaths.length === 1;
            const sessionVideoUrl = isSessionRecording ? d.answers.find((a) => a.video_url)?.video_url ?? null : null;
            return (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {d.interview.resume_url && (
                  <Button size="small" href={d.interview.resume_url} target="_blank">
                    {tr.downloadResume}
                  </Button>
                )}
                {isSessionRecording && sessionVideoUrl && (
                  <div>
                    <Typography.Title level={5} style={{ marginBottom: 8 }}>{tr.sessionVideo}</Typography.Title>
                    <VideoWithCover
                      src={sessionVideoUrl}
                      controls
                      preload="metadata"
                      style={{ width: "100%", maxWidth: 480, borderRadius: 8, background: "#000" }}
                      onLoadedData={(e) => { sessionVideoRef.current = e.currentTarget; }}
                    />
                  </div>
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
                {/* Advanced（自製 CV）：AI 按作答生成的結構化 CV */}
                {d.interview.plan === "advanced" && (
                  d.interview.cv ? (
                    <Card
                      size="small"
                      title={tr.cvTitle}
                      style={{ background: "#f0f5ff" }}
                      extra={
                        <Button
                          size="small"
                          onClick={() => {
                            const cv = d.interview.cv!;
                            const blob = new Blob([cvToText(cv, tr.cvSections)], { type: "text/plain;charset=utf-8" });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `${cv.fullName || iv.worker_name}-CV.txt`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }}
                        >
                          {tr.cvDownload}
                        </Button>
                      }
                    >
                      {(() => {
                        const cv = d.interview.cv!;
                        const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
                          <div style={{ marginBottom: 12 }}>
                            <Typography.Title level={5} style={{ marginBottom: 4 }}>{title}</Typography.Title>
                            {children}
                          </div>
                        );
                        return (
                          <>
                            <Typography.Paragraph>{cv.summary}</Typography.Paragraph>
                            {cv.basicInfo.length > 0 && (
                              <Sec title={tr.cvSections.basicInfo}>
                                {cv.basicInfo.map((p, i) => <div key={i}><strong>{p.label}：</strong>{p.value}</div>)}
                              </Sec>
                            )}
                            {cv.languages.length > 0 && (
                              <Sec title={tr.cvSections.languages}>
                                <div>{cv.languages.join("、")}</div>
                              </Sec>
                            )}
                            {cv.workExperience.length > 0 && (
                              <Sec title={tr.cvSections.workExperience}>
                                <ul style={{ margin: 0, paddingInlineStart: 18 }}>{cv.workExperience.map((w, i) => <li key={i}>{w}</li>)}</ul>
                              </Sec>
                            )}
                            {cv.skills.length > 0 && (
                              <Sec title={tr.cvSections.skills}>
                                <div>{cv.skills.join("、")}</div>
                              </Sec>
                            )}
                            {cv.careExperience.length > 0 && (
                              <Sec title={tr.cvSections.careExperience}>
                                {cv.careExperience.map((p, i) => <div key={i}><strong>{p.label}：</strong>{p.value}</div>)}
                              </Sec>
                            )}
                            {cv.education && <Sec title={tr.cvSections.education}><div>{cv.education}</div></Sec>}
                            {cv.availability && <Sec title={tr.cvSections.availability}><div>{cv.availability}</div></Sec>}
                            {cv.additionalNotes && <Sec title={tr.cvSections.additionalNotes}><div>{cv.additionalNotes}</div></Sec>}
                          </>
                        );
                      })()}
                    </Card>
                  ) : iv.status === "completed" ? (
                    <Typography.Text type="secondary">{tr.cvMissing}</Typography.Text>
                  ) : null
                )}
                {d.answers.length > 0 ? (
                  <List
                    dataSource={d.answers}
                    renderItem={(a) => (
                      <List.Item>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Space wrap>
                            <strong>{a.question_text}</strong>
                            <Tag color={a.passed ? "green" : "red"}>
                              {tr.attempt(a.attempt)} · {a.passed ? tr.passed : tr.failed}
                            </Tag>
                            {/* 整場錄製：該題在視頻中的定位秒數，點擊跳轉頂部視頻播放 */}
                            {isSessionRecording && a.video_start != null && a.video_end != null && (
                              <Typography.Link
                                onClick={() => {
                                  const v = sessionVideoRef.current;
                                  if (!v) return;
                                  try {
                                    v.currentTime = a.video_start!;
                                    void v.play().catch(() => {});
                                    v.scrollIntoView({ behavior: "smooth", block: "center" });
                                  } catch { /* 視頻未緩衝好時忽略 */ }
                                }}
                              >
                                ⏱ {tr.videoAt(a.video_start, a.video_end)}
                              </Typography.Link>
                            )}
                          </Space>
                          {/* 整場錄製：該題切出嘅音頻段（僱主逐題試聽） */}
                          {isSessionRecording && a.audio_url && (
                            <audio controls preload="none" src={a.audio_url} style={{ width: "100%", maxWidth: 420, height: 36 }} />
                          )}
                          {a.transcript && (
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                              {a.transcript}
                            </Typography.Paragraph>
                          )}
                          {a.feedback && (
                            <Typography.Text type="danger">{tr.aiFeedback(a.feedback)}</Typography.Text>
                          )}
                          {!isSessionRecording && a.video_url && (
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
