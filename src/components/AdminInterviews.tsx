"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  List,
  Popconfirm,
  Space,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";

interface Question {
  id: string;
  question: string;
  focus: string | null;
  sort_order: number;
  active: boolean;
  /** 各語言 TTS 音頻路徑（空 = 未生成） */
  audio?: Record<string, string> | null;
  /** 各語言音頻簽名 URL（供試聽） */
  audioUrls?: Record<string, string> | null;
}

/** 試聽用語言 */
const AUDIO_LANGS = [
  { key: "en", label: "EN" },
  { key: "id", label: "ID" },
  { key: "tl", label: "FIL" },
  { key: "zh", label: "普" },
] as const;

/** 視頻面試 tab：題庫管理 + 發起新面試（記錄在獨立「面試記錄」tab） */
export default function AdminInterviews({
  apiBase = "/api/admin",
  section = "all",
  onCreated,
}: {
  apiBase?: string;
  /** 渲染範圍：all=題庫+發起（後台用）；questions=僅題庫；create=僅發起面試 */
  section?: "all" | "questions" | "create";
  /** 創建成功回調（由父層負責彈窗/切換 tab）；不傳則用內建 antd 彈窗 */
  onCreated?: (info: { token: string; link: string }) => void;
}) {
  const { message, modal } = App.useApp();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingQ, setAddingQ] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState<string | null>(null);
  const [playingLang, setPlayingLang] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  /** 試聽某語言的題目語音（再次點擊停止） */
  const previewAudio = (key: string, url: string) => {
    if (playingLang === key) {
      audioRef.current?.pause();
      setPlayingLang(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.src = url;
    a.onended = () => setPlayingLang(null);
    a.onerror = () => setPlayingLang(null);
    setPlayingLang(key);
    a.play().catch(() => setPlayingLang(null));
  };
  const [newQ, setNewQ] = useState({ question: "", focus: "" });
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm<{ workerName: string; resumeText?: string }>();
  // 簡歷必填（文件或文字至少一種）：沒有簡歷 AI 無法做匹配分析
  const workerNameValue = Form.useWatch("workerName", form);
  const resumeTextValue = Form.useWatch("resumeText", form);
  const resumeProvided = Boolean((resumeTextValue || "").trim()) || fileList.length > 0;
  const canCreate = Boolean((workerNameValue || "").trim()) && resumeProvided;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/interview/questions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setQuestions(data.questions || []);
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

  const addQuestion = async () => {
    if (!newQ.question.trim()) return message.warning("請填寫問題");
    setAddingQ(true);
    const res = await fetch(`${apiBase}/interview/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newQ, sortOrder: questions.length }),
    });
    setAddingQ(false);
    if (!res.ok) return message.error((await res.json()).error || "新增失敗");
    message.success("已新增問題");
    setNewQ({ question: "", focus: "" });
    void load();
  };

  const toggleQuestion = async (q: Question) => {
    await fetch(`${apiBase}/interview/questions/${q.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
    void load();
  };

  const generateAudio = async (q: Question) => {
    const key = `audio-${q.id}`;
    setAudioBusy(key);
    try {
      const res = await fetch(`${apiBase}/interview/questions/${q.id}/audio`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "生成失敗");
        return;
      }
      message.success("已生成 4 語言語音");
      void load();
    } catch {
      message.error("生成失敗");
    } finally {
      setAudioBusy(null);
    }
  };

  const deleteQuestion = async (q: Question) => {
    setDeletingId(q.id);
    try {
      const res = await fetch(`${apiBase}/interview/questions/${q.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success("已刪除");
        void load();
      } else {
        message.error((await res.json()).error || "刪除失敗");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const createInterview = async (values: { workerName: string; resumeText?: string }) => {
    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("workerName", values.workerName);
      fd.set("resumeText", values.resumeText || "");
      const file = fileList[0]?.originFileObj;
      if (file) fd.set("resume", file);
      const res = await fetch(`${apiBase}/interviews`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "創建失敗");
        return;
      }
      const link = `${window.location.origin}/interview/${data.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      form.resetFields();
      setFileList([]);
      if (onCreated) {
        onCreated({ token: data.token, link }); // 父層：切到面試記錄 + 顯示彈窗
        return;
      }
      modal.success({
        title: "面試連結已生成（已複製）",
        content: (
          <Typography.Paragraph copyable style={{ wordBreak: "break-all" }}>
            {link}
          </Typography.Paragraph>
        ),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* 題庫管理 */}
      {section !== "create" && (
      <Card
        title="面試問題管理"
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>刷新</Button>}
      >
        <List
          loading={loading}
          dataSource={questions}
          locale={{ emptyText: "暫無問題，請先新增" }}
          renderItem={(q) => (
            <List.Item
              style={{ opacity: q.active ? 1 : 0.45 }}
              actions={[
                <Button key="a" size="small" onClick={() => generateAudio(q)} loading={audioBusy === `audio-${q.id}`}>
                  {q.audio && Object.keys(q.audio).length > 0 ? "重生成語音" : "生成語音"}
                </Button>,
                <Button key="t" size="small" onClick={() => toggleQuestion(q)}>
                  {q.active ? "停用" : "啟用"}
                </Button>,
                <Popconfirm
                  key="d"
                  title={`刪除「${q.question}」？`}
                  okText="刪除"
                  cancelText="取消"
                  okButtonProps={{ loading: deletingId === q.id }}
                  onConfirm={() => deleteQuestion(q)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} loading={deletingId === q.id} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={q.question}
                description={
                  <div>
                    {q.focus ? <div style={{ marginBottom: 6 }}>{`考察：${q.focus}`}</div> : null}
                    <div className="admin-audio-row">
                      <span className="admin-audio-label">試聽：</span>
                      {AUDIO_LANGS.map((l) => {
                        const url = q.audioUrls?.[l.key];
                        const playing = playingLang === l.key;
                        return (
                          <button
                            key={l.key}
                            type="button"
                            disabled={!url}
                            title={url ? `播放 ${l.label}` : `${l.label} 暫無語音`}
                            onClick={() => url && previewAudio(l.key, url)}
                            className={`admin-audio-btn${playing ? " playing" : ""}`}
                          >
                            {playing ? "■" : "▶"} {l.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        <div className="admin-q-add">
          <Input
            placeholder="問題，例如：請介紹你照顧初生嬰兒嘅經驗"
            value={newQ.question}
            onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
          />
          <Input
            placeholder="考察要點（可選）"
            value={newQ.focus}
            onChange={(e) => setNewQ({ ...newQ, focus: e.target.value })}
          />
          <Button type="primary" icon={<PlusOutlined />} loading={addingQ} onClick={addQuestion}>
            新增
          </Button>
        </div>
      </Card>
      )}

      {/* 發起面試 */}
      {section !== "questions" && (
      <Card title="發起新面試">
        <Form form={form} layout="vertical" onFinish={createInterview}>
          <Form.Item
            name="workerName"
            label="工人姓名"
            rules={[{ required: true, message: "請填寫工人姓名" }]}
          >
            <Input placeholder="工人姓名" />
          </Form.Item>
          <Form.Item
            label="簡歷文件（PDF/TXT，≤4MB）"
            required
            tooltip="文件或文字至少提供一種；圖片簡歷請直接貼上文字"
          >
            <Upload
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              accept=".pdf,.txt"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>選擇文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="resumeText" label="簡歷文字（上傳 PDF/TXT 會自動提取；圖片簡歷請手動貼上）">
            <Input.TextArea rows={4} placeholder="貼上簡歷文字" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<LinkOutlined />}
            loading={creating}
            disabled={!canCreate}
          >
            生成面試連結
          </Button>
          {!canCreate && (
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              需要工人姓名 + 簡歷（文件或文字至少一種）才能發起面試
            </Typography.Text>
          )}
        </Form>
      </Card>
      )}
    </Space>
  );
}
