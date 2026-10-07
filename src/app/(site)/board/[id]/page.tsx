"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart, MessageCircle, Pin, Send, Trash2 } from "lucide-react";
import { Button, Modal, Textarea } from "@/components/ui";
import { openLogin } from "@/components/auth/login-events";
import { useLanguage, LOCALES } from "@/lib/i18n";

interface PostDetail {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  own: boolean;
  pinned: boolean;
  authorName: string;
  companyName: string;
}

interface BoardComment {
  id: string;
  content: string;
  createdAt: string;
  own: boolean;
  authorName: string;
  companyName: string;
}

type Phase = "loading" | "login" | "forbidden" | "notfound" | "failed" | "ready";

/** 交流區帖子詳情頁：全文 + 讚好 + 留言（需登入且審核通過） */
export default function BoardPostPage() {
  const { t, locale } = useLanguage();
  /** 日期格式化語言標籤（zh-HK / zh-CN / en） */
  const dateLocale = LOCALES.find((l) => l.key === locale)?.htmlLang ?? "zh-HK";
  const params = useParams<{ id: string }>();
  const postId = params.id;

  const [phase, setPhase] = useState<Phase>("loading");
  const [post, setPost] = useState<PostDetail | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [liking, setLiking] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BoardComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // 先查登入狀態，再拉帖子詳情（401/403 分支更清晰）
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({}));
      if (!me.customer) {
        setPhase("login");
        return;
      }
      const res = await fetch(`/api/board/${postId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setPhase("notfound");
        return;
      }
      if (res.status === 403) {
        setPhase("forbidden");
        return;
      }
      if (!res.ok) {
        setPhase("failed");
        return;
      }
      setPost(data.post);
      setCanManage(Boolean(data.canManage));
      setLikeCount(data.likeCount);
      setLikedByMe(Boolean(data.likedByMe));
      setComments(data.comments || []);
      setPhase("ready");
    } catch {
      setPhase("failed");
    }
  }, [postId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await fetch(`/api/board/${postId}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLikedByMe(Boolean(data.liked));
        setLikeCount(data.likeCount);
      }
    } catch {
      /* 忽略，下次刷新會對齊 */
    } finally {
      setLiking(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch(`/api/board/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.workspace.board.commentFailed);
        return;
      }
      setComments((prev) => [...prev, data.comment as BoardComment]);
      setDraft("");
    } catch {
      setError(t.workspace.networkError);
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/board/${postId}/comments/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch {
      /* 忽略 */
    } finally {
      setDeleting(false);
    }
  };

  /** 點擊帖子內容圖片全屏查看 */
  const onContentClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLImageElement) setLightboxSrc(e.target.src);
  };

  return (
    <div className="relative flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="relative mx-auto max-w-[760px]">
        {/* 返回連結 */}
        <Link
          href="/booking?tab=board"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2a8163] transition-colors hover:text-[#161b2e]"
        >
          {t.workspace.board.backToBoard}
        </Link>

        {phase === "loading" && (
          <p className="py-16 text-center text-[13px] text-[#8b95ad]">{t.workspace.loading}</p>
        )}

        {(phase === "login" || phase === "forbidden" || phase === "notfound" || phase === "failed") && (
          <div className="card mt-5 p-10 text-center">
            <p className="text-[14px] leading-[1.85] text-[#5d6b85]">
              {phase === "login"
                ? t.workspace.board.needLogin
                : phase === "forbidden"
                  ? t.workspace.board.needApproval
                  : phase === "notfound"
                    ? t.workspace.board.notFound
                    : t.workspace.board.loadFailed}
            </p>
            {phase === "login" && (
              <Button size="lg" className="mt-6" onClick={() => openLogin()}>
                {t.header.login}
              </Button>
            )}
            {phase === "failed" && (
              <Button size="lg" className="mt-6" onClick={() => void load()}>
                {t.workspace.board.loadFailed} ↻
              </Button>
            )}
          </div>
        )}

        {phase === "ready" && post && (
          <>
            {/* 帖子全文卡 */}
            <article className="mt-5 rounded-2xl border border-black/[0.06] border-l-4 border-l-[#35a07a] bg-white px-4 py-4 shadow-[0_2px_10px_rgba(22,27,46,0.05)] sm:px-6 sm:py-5">
              <h1 className="flex items-start gap-2 text-[18px] font-extrabold text-[#161b2e] sm:text-[20px]">
                {post.pinned && <Pin size={16} className="mt-1 shrink-0 text-[#2a8163]" aria-hidden="true" />}
                {post.title}
              </h1>
              <p className="mt-2 text-[12px] font-semibold text-[#8b95ad]">
                <span className="text-[#2a8163]">{post.authorName}</span>
                {post.companyName ? ` · ${post.companyName}` : ""}
                {" · "}
                {new Date(post.createdAt).toLocaleString(dateLocale)}
              </p>
              <div
                className="tiptap tiptap-view mt-3"
                onClick={onContentClick}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
              {/* 讚好 + 留言數 */}
              <div className="mt-4 flex items-center gap-3 border-t border-black/[0.05] pt-4">
                <button
                  type="button"
                  onClick={() => void toggleLike()}
                  disabled={liking}
                  aria-pressed={likedByMe}
                  aria-label={likedByMe ? t.workspace.board.unlike : t.workspace.board.like}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-all disabled:opacity-60 ${
                    likedByMe
                      ? "bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white shadow-[0_4px_12px_rgba(53,160,122,0.35)]"
                      : "bg-black/[0.04] text-[#5d6b85] hover:bg-[#e9f5f0] hover:text-[#2a8163]"
                  }`}
                >
                  <Heart size={15} aria-hidden="true" fill={likedByMe ? "currentColor" : "none"} />
                  {likeCount}
                </button>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8b95ad]">
                  <MessageCircle size={15} aria-hidden="true" />
                  {t.workspace.board.comments(comments.length)}
                </span>
              </div>
            </article>

            {/* 留言區 */}
            <section className="mt-6">
              <h2 className="mb-3 text-[15px] font-extrabold text-[#161b2e]">
                {t.workspace.board.comments(comments.length)}
              </h2>

              {/* 發表留言 */}
              <form onSubmit={(e) => void submitComment(e)} className="flex flex-col gap-2.5">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={500}
                  rows={3}
                  required
                  placeholder={t.workspace.board.commentPlaceholder}
                />
                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-600">{error}</p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={posting} disabled={!draft.trim()}>
                    <Send size={13} aria-hidden="true" />
                    {t.workspace.board.postComment}
                  </Button>
                </div>
              </form>

              {/* 留言列表 */}
              <div className="mt-4 flex flex-col gap-2.5">
                {comments.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-black/[0.1] px-5 py-8 text-center text-[13px] text-[#8b95ad]">
                    {t.workspace.board.noComments}
                  </p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-[13px] shadow-[0_2px_8px_rgba(22,27,46,0.04)]"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-[#8b95ad]">
                          <span className="text-[#2a8163]">{c.authorName}</span>
                          {c.companyName ? ` · ${c.companyName}` : ""}
                          {" · "}
                          {new Date(c.createdAt).toLocaleString(dateLocale)}
                        </p>
                        {(c.own || post.own || canManage) && (
                          <button
                            type="button"
                            aria-label={t.workspace.board.deleteComment}
                            title={t.workspace.board.deleteComment}
                            onClick={() => setDeleteTarget(c)}
                            className="ml-auto cursor-pointer p-1 text-[#8b95ad] transition-colors hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 leading-[1.75] whitespace-pre-wrap text-[#3d4763]">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* 刪除留言確認彈窗 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t.workspace.board.deleteComment}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t.workspace.board.cancel}
            </Button>
            <Button variant="danger" onClick={() => void removeComment()} loading={deleting}>
              {t.workspace.board.confirmDelete}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-[1.8] text-[#5d6b85]">{t.workspace.board.deleteCommentConfirm}</p>
        {deleteTarget && (
          <p className="mt-3 line-clamp-3 rounded-xl bg-black/[0.03] px-4 py-2.5 text-[13px] text-[#3d4763]">
            {deleteTarget.content}
          </p>
        )}
      </Modal>

      {/* 圖片全屏查看 */}
      {lightboxSrc && (
        <div
          role="button"
          aria-label={t.workspace.board.closePreview}
          className="fixed inset-0 z-[1000] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={t.workspace.board.imageAlt}
            className="max-h-[92vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
