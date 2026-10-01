"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquareText, Pencil, Pin, PinOff, Send, SquarePen, Trash2 } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import RichTextEditor from "@/components/RichTextEditor";
import { useLanguage, LOCALES } from "@/lib/i18n";

interface BoardPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  own: boolean;
  pinned: boolean;
  authorName: string;
  companyName: string;
}

/** 去 HTML 標籤取純文本（置頂卡摘要用） */
function plainExcerpt(html: string, max = 50): string {
  if (typeof document === "undefined") return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 時間軸左欄用：MM-DD / HH:mm 兩行（語言無關，直接格式化） */
function timeParts(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
    time: `${p2(d.getHours())}:${p2(d.getMinutes())}`,
  };
}

/**
 * 資訊交流區：審核通過用戶可發帖分享資訊、刪除自己的帖子（需確認）。
 * 管理員（canManage）可置頂 / 取消置頂及刪除任何帖子；置頂帖以卡片形式置頂展示。
 * 非置頂帖分頁（每頁 10 條），底部哨兵元素進入視口時自動載入下一頁。
 */
export default function BoardPanel() {
  const { t, locale } = useLanguage();
  /** 日期格式化語言標籤（zh-HK / zh-CN / en） */
  const dateLocale = LOCALES.find((l) => l.key === locale)?.htmlLang ?? "zh-HK";
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<BoardPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  /** 編輯中的帖子；null = 發新帖模式 */
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);
  const [viewPost, setViewPost] = useState<BoardPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardPost | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  /** 防止哨兵連續觸發導致重複請求 */
  const fetchingRef = useRef(false);

  /** 首頁 / 刷新（offset=0，重置列表） */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/board?offset=0", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setPosts(data.posts);
        setPinnedPosts(data.pinned);
        setHasMore(Boolean(data.hasMore));
        setCanManage(Boolean(data.canManage));
      }
    } catch {
      /* 列表失敗唔阻住發帖 */
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** 載入下一頁（追加） */
  const loadMore = async () => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/board?offset=${posts.length}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) => [...prev, ...(data.posts as BoardPost[])]);
        setHasMore(Boolean(data.hasMore));
      }
    } catch {
      /* 下一頁失敗：哨兵會再次觸發 */
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  };

  // 無限滾動：哨兵進入視口即載入下一頁（無 deps，每次渲染重新綁定，保證閉包最新）
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  });

  /** 打開發帖彈窗（新帖模式）；從編輯模式切返嚟時清空草稿避免串帖 */
  const openCreate = () => {
    if (editingPost) {
      setTitle("");
      setContent("");
    }
    setEditingPost(null);
    setError("");
    setComposerOpen(true);
  };

  /** 打開發帖彈窗（編輯模式）：預填標題 + 內容 */
  const openEdit = (p: BoardPost) => {
    setEditingPost(p);
    setTitle(p.title);
    setContent(p.content);
    setError("");
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (posting) return;
    setComposerOpen(false);
    setEditingPost(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setError("");
    try {
      const res = editingPost
        ? await fetch(`/api/board/${editingPost.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "edit", title, content }),
          })
        : await fetch("/api/board", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (editingPost ? t.workspace.board.saveFailed : t.workspace.board.publishFailed));
        return;
      }
      setTitle("");
      setContent("");
      setEditingPost(null);
      setComposerOpen(false); // 發佈 / 保存後收起，直接睇帖子
      await load();
    } catch {
      setError(t.workspace.networkError);
    } finally {
      setPosting(false);
    }
  };

  /** 確認刪除（自己嘅帖或管理員刪任何帖都行呢度） */
  const remove = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/board/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setPinnedPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        if (viewPost?.id === deleteTarget.id) setViewPost(null);
        setDeleteTarget(null);
      }
    } catch {
      /* 忽略 */
    } finally {
      setDeletingId(null);
    }
  };

  /** 置頂 / 取消置頂（僅管理員，前端冇確認直接生效） */
  const togglePin = async (p: BoardPost) => {
    setPinningId(p.id);
    try {
      const res = await fetch(`/api/board/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: p.pinned ? "unpin" : "pin" }),
      });
      if (res.ok) await load();
    } catch {
      /* 忽略 */
    } finally {
      setPinningId(null);
    }
  };

  /** 點擊帖子內容圖片全屏查看（列表 + 詳情彈窗共用） */
  const onContentClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLImageElement) setLightboxSrc(e.target.src);
  };

  const authorLine = (p: BoardPost) => (
    <>
      <span className="text-[#2a8163]">{p.authorName}</span>
      {p.companyName ? ` · ${p.companyName}` : ""}
      {" · "}
      {new Date(p.createdAt).toLocaleString(dateLocale)}
    </>
  );

  /** 帖子操作按鈕（作者/管理員：編輯；管理員：置頂；作者或管理員：刪除） */
  const postActions = (p: BoardPost) => (
    <>
      {(p.own || canManage) && (
        <button
          type="button"
          aria-label={t.workspace.board.edit}
          title={t.workspace.board.edit}
          onClick={(e) => {
            e.stopPropagation();
            openEdit(p);
          }}
          className="cursor-pointer p-1 text-[#8b95ad] transition-colors hover:text-[#161b2e]"
        >
          <Pencil size={15} />
        </button>
      )}
      {canManage && (
        <button
          type="button"
          aria-label={p.pinned ? t.workspace.board.unpin : t.workspace.board.pin}
          title={p.pinned ? t.workspace.board.unpin : t.workspace.board.pin}
          disabled={pinningId === p.id}
          onClick={(e) => {
            e.stopPropagation();
            void togglePin(p);
          }}
          className={`cursor-pointer p-1 transition-colors disabled:opacity-50 ${
            p.pinned ? "text-[#2a8163] hover:text-[#8b95ad]" : "text-[#8b95ad] hover:text-[#2a8163]"
          }`}
        >
          {p.pinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>
      )}
      {(canManage || p.own) && (
        <button
          type="button"
          aria-label={t.workspace.board.deletePost}
          disabled={deletingId === p.id}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(p);
          }}
          className="cursor-pointer p-1 text-[#8b95ad] transition-colors hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      )}
    </>
  );

  return (
    <div>
      {/* 發帖入口：按鈕 + 大彈窗 */}
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <SquarePen size={14} aria-hidden="true" />
          {t.workspace.board.publishNew}
        </Button>
      </div>

      {/* 置頂帖子區 */}
      {pinnedPosts.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-[14px] font-extrabold text-[#161b2e]">{t.workspace.board.pinnedSection}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedPosts.map((p) => (
              <div key={p.id} className="relative">
                <button
                  type="button"
                  onClick={() => setViewPost(p)}
                  className="flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-2xl border border-[#35a07a]/25 bg-gradient-to-b from-[#e9f5f0]/70 to-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#35a07a]/60 hover:shadow-[0_8px_20px_rgba(42,148,112,0.14)]"
                >
                  <span className={`flex items-start gap-1.5 ${canManage ? "pr-12" : ""}`}>
                    <Pin size={13} className="mt-0.5 shrink-0 text-[#2a8163]" aria-hidden="true" />
                    <span className="line-clamp-2 text-[13.5px] font-bold text-[#161b2e]">{p.title}</span>
                  </span>
                  <span className="line-clamp-2 text-[12px] leading-[1.6] text-[#5d6b85]">{plainExcerpt(p.content)}</span>
                  <span className="mt-auto pt-1 text-[11px] font-semibold text-[#8b95ad]">
                    {p.authorName} · {new Date(p.createdAt).toLocaleDateString(dateLocale)}
                  </span>
                </button>
                {/* 管理員操作：取消置頂 / 刪除（刪除有確認彈窗） */}
                {canManage && (
                  <span className="absolute top-2.5 right-2.5 flex gap-0.5">
                    <button
                      type="button"
                      aria-label={t.workspace.board.unpin}
                      title={t.workspace.board.unpin}
                      disabled={pinningId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void togglePin(p);
                      }}
                      className="cursor-pointer rounded-lg bg-white/80 p-1.5 text-[#2a8163] shadow-sm transition-colors hover:text-[#8b95ad] disabled:opacity-50"
                    >
                      <PinOff size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={t.workspace.board.deletePost}
                      disabled={deletingId === p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(p);
                      }}
                      className="cursor-pointer rounded-lg bg-white/80 p-1.5 text-[#8b95ad] shadow-sm transition-colors hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 帖子時間軸（左：時間 + 軸線 + 圓點；右：帖子卡片） */}
      <div className="mt-7">
        {loading ? (
          <p className="py-10 text-center text-[13px] text-[#8b95ad]">{t.workspace.loading}</p>
        ) : posts.length === 0 && pinnedPosts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/[0.1] px-5 py-10 text-center text-[13px] text-[#8b95ad]">
            {t.workspace.board.empty}
          </p>
        ) : (
          <>
            {posts.map((p, i) => {
              const tp = timeParts(p.createdAt);
              const last = i === posts.length - 1 && !hasMore;
              return (
                <div key={p.id} className="flex gap-3 pb-3 sm:gap-4 sm:pb-4">
                  {/* 時間欄 + 軸線 + 圓點（pr 令文字同軸線/圓點保持距離） */}
                  <div className="relative w-12 shrink-0 pr-4 text-right sm:w-16 sm:pr-5">
                    <div className="text-[11px] font-bold text-[#5d6b85] sm:text-[12px]">{tp.day}</div>
                    <div className="text-[10px] text-[#8b95ad] sm:text-[11px]">{tp.time}</div>
                    {/* 軸線：最後一行只畫到圓點為止 */}
                    <span
                      aria-hidden="true"
                      className={`absolute top-0 right-0 w-px bg-black/[0.08] ${last ? "h-2.5" : "h-full"}`}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute top-1 -right-[5px] h-2.5 w-2.5 rounded-full border-2 border-white bg-[#35a07a] shadow-[0_2px_6px_rgba(53,160,122,0.4)]"
                    />
                  </div>
                  {/* 帖子卡片 */}
                  <article className="min-w-0 flex-1 rounded-2xl border border-black/[0.06] border-l-4 border-l-[#35a07a] bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(22,27,46,0.05)] sm:px-5 sm:py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-[14px] font-extrabold text-[#161b2e] sm:text-[15px]">{p.title}</h3>
                      <span className="ml-auto flex items-center gap-1.5 sm:gap-2.5">{postActions(p)}</span>
                    </div>
                    <div
                      className="tiptap tiptap-view mt-1.5"
                      onClick={onContentClick}
                      dangerouslySetInnerHTML={{ __html: p.content }}
                    />
                    <p className="mt-2.5 text-[12px] font-semibold text-[#8b95ad]">{authorLine(p)}</p>
                  </article>
                </div>
              );
            })}

            {/* 無限滾動哨兵 + 狀態行 */}
            {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
            {loadingMore && (
              <p className="py-4 text-center text-[12.5px] text-[#8b95ad]">{t.workspace.board.loadingMore}</p>
            )}
            {!hasMore && posts.length > 0 && !loadingMore && (
              <p className="py-4 text-center text-[12.5px] text-[#8b95ad]">{t.workspace.board.allLoaded}</p>
            )}
          </>
        )}
      </div>

      {/* 發帖 / 編輯大彈窗（key 保證切換帖子時編輯器重新初始化內容） */}
      <Modal
        open={composerOpen}
        onClose={closeComposer}
        title={
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white">
              {editingPost ? <Pencil size={14} aria-hidden="true" /> : <MessageSquareText size={14} aria-hidden="true" />}
            </span>
            {editingPost ? t.workspace.board.editPost : t.workspace.board.composerTitle}
          </span>
        }
        widthClassName="max-w-2xl"
        className="p-5 sm:p-7"
      >
        <form key={editingPost ? `edit-${editingPost.id}` : "new"} onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            placeholder={t.workspace.board.titlePlaceholder}
          />
          <p className="-mb-1 text-[12px] text-[#8b95ad]">{t.workspace.board.contentHint}</p>
          <RichTextEditor value={content} onChange={setContent} disabled={posting} />
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">{error}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={posting}>
              <Send size={14} aria-hidden="true" />
              {editingPost ? t.workspace.board.save : t.workspace.board.publish}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 置頂帖全文彈窗（作者 / 管理員可喺度直接編輯） */}
      <Modal
        open={viewPost !== null}
        onClose={() => setViewPost(null)}
        title={viewPost?.title}
        widthClassName="max-w-2xl"
        className="p-5 sm:p-7"
        closeLabel={t.workspace.board.closePostDetail}
        footer={
          viewPost && (viewPost.own || canManage) ? (
            <Button
              variant="secondary"
              onClick={() => {
                openEdit(viewPost);
                setViewPost(null);
              }}
            >
              <Pencil size={14} aria-hidden="true" />
              {t.workspace.board.editPost}
            </Button>
          ) : undefined
        }
      >
        {viewPost && (
          <>
            <div
              className="tiptap tiptap-view"
              onClick={onContentClick}
              dangerouslySetInnerHTML={{ __html: viewPost.content }}
            />
            <p className="mt-4 text-[12px] font-semibold text-[#8b95ad]">{authorLine(viewPost)}</p>
          </>
        )}
      </Modal>

      {/* 刪除確認彈窗（自己嘅帖 / 管理員刪任何帖共用） */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => deletingId === null && setDeleteTarget(null)}
        title={t.workspace.board.deleteConfirmTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deletingId !== null}>
              {t.workspace.board.cancel}
            </Button>
            <Button variant="danger" onClick={() => void remove()} loading={deletingId !== null}>
              {t.workspace.board.confirmDelete}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-[1.8] text-[#5d6b85]">{t.workspace.board.deleteConfirmBody}</p>
        {deleteTarget && (
          <p className="mt-3 rounded-xl bg-black/[0.03] px-4 py-2.5 text-[13px] font-semibold text-[#3d4763]">
            {deleteTarget.title}
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
