"use client";

import { useCallback, useEffect, useState } from "react";
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
}

/** 視頻面試 tab：題庫管理 + 發起新面試（記錄在獨立「面試記錄」tab） */
export default function AdminInterviews({ password }: { password: string }) {
  const { message, modal } = App.useApp();
  const headers = { "x-admin-auth": password };
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingQ, setAddingQ] = useState(false);
  const [newQ, setNewQ] = useState({ question: "", focus: "" });
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm<{ workerName: string; resumeText?: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/interview/questions", { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setQuestions(data.questions || []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addQuestion = async () => {
    if (!newQ.question.trim()) return message.warning("請填寫問題");
    setAddingQ(true);
    const res = await fetch("/api/admin/interview/questions", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...newQ, sortOrder: questions.length }),
    });
    setAddingQ(false);
    if (!res.ok) return message.error((await res.json()).error || "新增失敗");
    message.success("已新增問題");
    setNewQ({ question: "", focus: "" });
    void load();
  };

  const toggleQuestion = async (q: Question) => {
    await fetch(`/api/admin/interview/questions/${q.id}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
    void load();
  };

  const deleteQuestion = async (q: Question) => {
    const res = await fetch(`/api/admin/interview/questions/${q.id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      message.success("已刪除");
      void load();
    } else {
      message.error("刪除失敗");
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
      const res = await fetch("/api/admin/interviews", { method: "POST", headers, body: fd });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "創建失敗");
        return;
      }
      const link = `${window.location.origin}/interview/${data.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      modal.success({
        title: "面試連結已生成（已複製）",
        content: (
          <Typography.Paragraph copyable style={{ wordBreak: "break-all" }}>
            {link}
          </Typography.Paragraph>
        ),
      });
      form.resetFields();
      setFileList([]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* 題庫管理 */}
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
                <Button key="t" size="small" onClick={() => toggleQuestion(q)}>
                  {q.active ? "停用" : "啟用"}
                </Button>,
                <Popconfirm
                  key="d"
                  title={`刪除「${q.question}」？`}
                  okText="刪除"
                  cancelText="取消"
                  onConfirm={() => deleteQuestion(q)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta title={q.question} description={q.focus ? `考察：${q.focus}` : null} />
            </List.Item>
          )}
        />
        <Space.Compact style={{ width: "100%", marginTop: 12 }}>
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
        </Space.Compact>
      </Card>

      {/* 發起面試 */}
      <Card title="發起新面試">
        <Form form={form} layout="vertical" onFinish={createInterview}>
          <Form.Item
            name="workerName"
            label="工人姓名"
            rules={[{ required: true, message: "請填寫工人姓名" }]}
          >
            <Input placeholder="工人姓名" />
          </Form.Item>
          <Form.Item label="簡歷文件（PDF/TXT，≤4MB，可選）">
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
          <Form.Item name="resumeText" label="簡歷文字（可選；上傳 PDF/TXT 會自動提取）">
            <Input.TextArea rows={4} placeholder="圖片簡歷請手動貼上文字" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<LinkOutlined />} loading={creating}>
            生成面試連結
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
