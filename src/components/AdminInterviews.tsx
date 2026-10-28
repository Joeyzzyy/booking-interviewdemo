"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  Form,
  Input,
  List,
  Popconfirm,
  Radio,
  Space,
  Tag,
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
import { useLanguage } from "@/lib/i18n";
import { ADVANCED_SECTIONS, ALL_QUESTION_SECTIONS, sectionLabel } from "@/lib/interview/shared-questions";

interface Question {
  id: string;
  question: string;
  focus: string | null;
  sort_order: number;
  active: boolean;
  /** 分類 key（公共題庫 = 表單章節；自定義題目為 null） */
  category?: string | null;
  /** 歸屬用戶 id（null = 公共題庫） */
  customer_id?: string | null;
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
  { key: "yue", label: "粵" },
] as const;

/** 視頻面試 tab：題庫管理 + 發起新面試（記錄在獨立「面試記錄」tab） */
export default function AdminInterviews({
  apiBase = "/api/admin",
  section = "all",
  onCreated,
  entitlement,
}: {
  apiBase?: string;
  /** 渲染範圍：all=題庫+發起（後台用）；questions=僅題庫；create=僅發起面試 */
  section?: "all" | "questions" | "create";
  /** 創建成功回調（由父層負責彈窗/切換 tab）；不傳則用內建 antd 彈窗 */
  onCreated?: (info: { token: string; link: string }) => void;
  /** 用戶訂閱權限（undefined = 後台/舊行為：basic、簡歷必填）；advanced 可選自製 CV + 章節 */
  entitlement?: "basic" | "advanced";
}) {
  const { message, modal } = App.useApp();
  const { t, locale } = useLanguage();
  const tq = t.workspace.interviewMgmt.questions;
  const tcr = t.workspace.interviewMgmt.create;
  const tm = t.workspace.interviewMgmt;
  /** 用戶工作台視圖（公共題庫只讀）；後台視圖可管理全部 */
  const isUserView = apiBase === "/api/my";
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
  const [form] = Form.useForm<{ workerName: string; resumeText?: string; plan?: string; sections?: string[] }>();
  // 簡歷必填（文件或文字至少一種）：basic（核實 CV）冇簡歷 AI 無法做匹配分析；advanced（自製 CV）可選
  const workerNameValue = Form.useWatch("workerName", form);
  const resumeTextValue = Form.useWatch("resumeText", form);
  const planValue = Form.useWatch("plan", form);
  /** advanced 訂閱用戶可選自製 CV；否則固定 basic */
  const canUseAdvanced = entitlement === "advanced";
  const effectivePlan = canUseAdvanced && planValue === "advanced" ? "advanced" : "basic";
  const resumeProvided = Boolean((resumeTextValue || "").trim()) || fileList.length > 0;
  const canCreate = Boolean((workerNameValue || "").trim()) && (effectivePlan === "advanced" || resumeProvided);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/interview/questions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tm.loadFailed);
      setQuestions(data.questions || []);
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

  /** 題目按分類分組：Basic 9 章 + Advanced 8 章（固定順序）→ 其他未知分類 → 自定義問題（最後） */
  const groups = useMemo(() => {
    const byCat = new Map<string, Question[]>();
    for (const q of questions) {
      const key = q.category || "custom";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(q);
    }
    const ordered: { key: string; label: string; items: Question[] }[] = [];
    for (const s of ALL_QUESTION_SECTIONS) {
      const items = byCat.get(s.key);
      if (items?.length) ordered.push({ key: s.key, label: sectionLabel(s.key, locale), items });
      byCat.delete(s.key);
    }
    const custom = byCat.get("custom");
    byCat.delete("custom");
    for (const [key, items] of byCat) ordered.push({ key, label: key, items }); // 未知分類原樣展示
    if (custom?.length) ordered.push({ key: "custom", label: tq.customGroup, items: custom });
    return ordered;
  }, [questions, locale, tq.customGroup]);

  /** 以彈窗展示錯誤/警告詳情（含上游返回原文，方便截圖診斷） */
  const showDetailModal = (type: "error" | "warning", title: string, detail: string) => {
    const content = (
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all text-[12px] leading-[1.7]">
        {detail}
      </pre>
    );
    if (type === "error") modal.error({ title, content, width: 560 });
    else modal.warning({ title, content, width: 560 });
  };

  const addQuestion = async () => {
    if (!newQ.question.trim()) return message.warning(tq.warnFill);
    setAddingQ(true);
    const res = await fetch(`${apiBase}/interview/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newQ, sortOrder: questions.length }),
    });
    setAddingQ(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return message.error(data.error || tq.addFailed);
    if (data.warning) {
      message.warning(tq.addedWithWarning);
      showDetailModal("warning", tq.warnModalTitle, data.warning);
    } else {
      message.success(tq.added);
    }
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(tq.audioFailed);
        showDetailModal("error", tq.audioFailedTitle, data.error || tq.genFailed);
        return;
      }
      if (data.warnings?.length) {
        message.warning(tq.audioPartial);
        showDetailModal("warning", tq.audioPartialTitle, data.warnings.join("\n\n"));
      } else {
        message.success(tq.audioDone);
      }
      void load();
    } catch (e) {
      message.error(tq.genFailed);
      showDetailModal("error", tq.audioFailedTitle, e instanceof Error ? e.message : String(e));
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
        message.success(tq.deleted);
        void load();
      } else {
        message.error((await res.json()).error || tq.deleteFailed);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const createInterview = async (values: { workerName: string; resumeText?: string; plan?: string; sections?: string[] }) => {
    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("workerName", values.workerName);
      fd.set("resumeText", values.resumeText || "");
      fd.set("plan", effectivePlan);
      if (effectivePlan === "advanced") {
        // 防御：Form 值異常（非數組）時回落到全部章節，避免 .join 崩潰
        const pickedSections = Array.isArray(values.sections) && values.sections.length > 0
          ? values.sections
          : ADVANCED_SECTIONS.map((s) => s.key);
        fd.set("sections", pickedSections.join(","));
      }
      const file = fileList[0]?.originFileObj;
      if (file) fd.set("resume", file);
      const res = await fetch(`${apiBase}/interviews`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || tcr.failed);
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
        title: tcr.linkModalTitle,
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
        title={tq.cardTitle}
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => load()}>{tm.refresh}</Button>}
      >
        {(() => {
          /** 單條題目渲染（分組列表共用） */
          const renderQuestion = (q: Question) => {
            // 公共題庫：用戶工作台只讀（後台仍可管理）
            const readOnly = isUserView && !q.customer_id;
            return (
              <List.Item
                style={{ opacity: q.active ? 1 : 0.45 }}
                actions={
                  readOnly
                    ? [<Tag key="s" color="blue" style={{ marginInlineEnd: 0 }}>{tq.sharedTag}</Tag>]
                    : [
                        <Button key="a" size="small" onClick={() => generateAudio(q)} loading={audioBusy === `audio-${q.id}`}>
                          {q.audio && Object.keys(q.audio).length > 0 ? tq.regenAudio : tq.genAudio}
                        </Button>,
                        <Button key="t" size="small" onClick={() => toggleQuestion(q)}>
                          {q.active ? tq.disable : tq.enable}
                        </Button>,
                        <Popconfirm
                          key="d"
                          title={tq.deleteTitle(q.question)}
                          okText={tq.deleteOk}
                          cancelText={tm.cancel}
                          okButtonProps={{ loading: deletingId === q.id }}
                          onConfirm={() => deleteQuestion(q)}
                        >
                          <Button size="small" danger icon={<DeleteOutlined />} loading={deletingId === q.id} />
                        </Popconfirm>,
                      ]
                }
              >
                <List.Item.Meta
                  title={
                    <Space size={8}>
                      {readOnly && <Tag color="blue">{tq.sharedTag}</Tag>}
                      <span>{q.question}</span>
                    </Space>
                  }
                  description={
                    <div>
                      {q.focus ? <div style={{ marginBottom: 6 }}>{tq.focusPrefix(q.focus)}</div> : null}
                      <div className="admin-audio-row">
                        <span className="admin-audio-label">{tq.preview}</span>
                        {AUDIO_LANGS.map((l) => {
                          const url = q.audioUrls?.[l.key];
                          const playing = playingLang === l.key;
                          return (
                            <button
                              key={l.key}
                              type="button"
                              disabled={!url}
                              title={url ? tq.play(l.label) : tq.noAudio(l.label)}
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
            );
          };
          if (!loading && questions.length === 0) {
            return <List locale={{ emptyText: tq.empty }} />;
          }
          return (
            <Collapse
              ghost
              defaultActiveKey={groups.map((g) => g.key)}
              items={groups.map((g) => ({
                key: g.key,
                label: (
                  <Space size={8}>
                    <span>{g.label}</span>
                    <Tag>{g.items.length}</Tag>
                  </Space>
                ),
                children: (
                  <List loading={loading} dataSource={g.items} renderItem={renderQuestion} />
                ),
              }))}
            />
          );
        })()}
        <div className="admin-q-add">
          <Input
            placeholder={tq.addPlaceholder}
            value={newQ.question}
            onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
          />
          <Input
            placeholder={tq.addFocusPlaceholder}
            value={newQ.focus}
            onChange={(e) => setNewQ({ ...newQ, focus: e.target.value })}
          />
          <Button type="primary" icon={<PlusOutlined />} loading={addingQ} onClick={addQuestion}>
            {tq.add}
          </Button>
        </div>
      </Card>
      )}

      {/* 發起面試 */}
      {section !== "questions" && (
      <Card title={tcr.cardTitle}>
        <Form form={form} layout="vertical" onFinish={createInterview}>
          <Form.Item
            name="workerName"
            label={tcr.workerNameLabel}
            rules={[{ required: true, message: tcr.workerNameRequired }]}
          >
            <Input placeholder={tcr.workerNameLabel} />
          </Form.Item>
          {canUseAdvanced && (
            <Form.Item name="plan" label={tcr.planLabel} initialValue="advanced">
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={[
                  { label: tcr.planAdvanced, value: "advanced" },
                  { label: tcr.planBasic, value: "basic" },
                ]}
              />
            </Form.Item>
          )}
          {effectivePlan === "advanced" && (
            // Checkbox.Group 必須是 Form.Item 的直接子元素，否則 value/onChange
            // 會注到 div 上，勾選時原生 change 冒泡導致 sections 變成單個字符串
            <Form.Item
              name="sections"
              label={tcr.sectionsLabel}
              initialValue={ADVANCED_SECTIONS.map((s) => s.key)}
              extra={<span className="block text-[12.5px] leading-[1.7] text-[#8b95ad]">{tcr.sectionsHint}</span>}
            >
              <Checkbox.Group
                className="grid grid-cols-2 gap-y-2"
                options={ADVANCED_SECTIONS.map((s) => ({
                  label: sectionLabel(s.key, locale),
                  value: s.key,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item
            label={tcr.resumeFileLabel}
            required={effectivePlan === "basic"}
            tooltip={effectivePlan === "advanced" ? tcr.resumeOptional : tcr.resumeTooltip}
          >
            <Upload
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              accept=".pdf,.txt"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>{tcr.chooseFile}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="resumeText" label={tcr.resumeTextLabel}>
            <Input.TextArea rows={4} placeholder={effectivePlan === "advanced" ? tcr.resumeOptional : tcr.resumeTextPlaceholder} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<LinkOutlined />}
            loading={creating}
            disabled={!canCreate}
          >
            {tcr.generateLink}
          </Button>
          {!canCreate && (
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              {tcr.hint}
            </Typography.Text>
          )}
        </Form>
      </Card>
      )}
    </Space>
  );
}
