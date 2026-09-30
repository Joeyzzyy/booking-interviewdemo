"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, Send, Trash2 } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";

interface BoardPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  own: boolean;
  authorName: string;
  companyName: string;
}

/** 資訊交流區：審核通過用戶可發帖分享資訊、刪除自己的帖子 */
export default function BoardPanel() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setPosts(data.posts);
    } catch {
      /* 列表失敗唔阻住發帖 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "發佈失敗，請稍後再試");
        return;
      }
      setTitle("");
      setContent("");
      await load();
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/board/${id}`, { method: "DELETE" });
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      /* 忽略 */
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* 發帖區 */}
      <form
        onSubmit={(e) => void submit(e)}
        className="rounded-3xl border border-[#35a07a]/25 bg-gradient-to-b from-[#e9f5f0]/70 to-white p-5 sm:p-6"
      >
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-[#161b2e]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white">
            <MessageSquareText size={14} aria-hidden="true" />
          </span>
          分享資訊
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            placeholder="標題（例如：某診所驗身排期經驗分享）"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            placeholder="內容：同其他僱傭中心分享你嘅資訊、經驗或提醒…"
          />
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">{error}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={posting}>
              <Send size={14} aria-hidden="true" />
              發佈
            </Button>
          </div>
        </div>
      </form>

      {/* 帖子列表 */}
      <div className="mt-7 flex flex-col gap-3">
        {loading ? (
          <p className="py-10 text-center text-[13px] text-[#8b95ad]">載入中…</p>
        ) : posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/[0.1] px-5 py-10 text-center text-[13px] text-[#8b95ad]">
            暫時未有帖子，做第一個分享嘅人啦！
          </p>
        ) : (
          posts.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-black/[0.06] border-l-4 border-l-[#35a07a] bg-white px-5 py-4 shadow-[0_2px_10px_rgba(22,27,46,0.05)]"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-[15px] font-extrabold text-[#161b2e]">{p.title}</h3>
                {p.own && (
                  <button
                    type="button"
                    aria-label="刪除帖子"
                    disabled={deletingId === p.id}
                    onClick={() => void remove(p.id)}
                    className="ml-auto cursor-pointer text-[#8b95ad] transition-colors hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[13.5px] leading-[1.8] whitespace-pre-wrap text-[#3d4763]">
                {p.content}
              </p>
              <p className="mt-2.5 text-[12px] font-semibold text-[#8b95ad]">
                <span className="text-[#2a8163]">{p.authorName}</span>
                {p.companyName ? ` · ${p.companyName}` : ""}
                {" · "}
                {new Date(p.createdAt).toLocaleString("zh-HK")}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
