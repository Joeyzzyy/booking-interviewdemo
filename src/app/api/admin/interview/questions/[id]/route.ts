import { getSupabase } from "@/lib/booking/db";
import { generateQuestionAssets } from "@/lib/interview/tts";
import { toUserMessage } from "@/lib/interview/ai-errors";
import { adminUnauthorized, isAdminRequest } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "sin1";

/** PUT 更新問題 { question?, focus?, sortOrder?, active? } */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { id } = await params;
  let body: { question?: string; focus?: string | null; sortOrder?: number; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.question !== undefined) {
    if (!body.question.trim()) return Response.json({ error: "問題不能為空" }, { status: 400 });
    update.question = body.question.trim();
  }
  if (body.focus !== undefined) update.focus = body.focus?.trim() || null;
  if (body.sortOrder !== undefined) update.sort_order = body.sortOrder;
  if (body.active !== undefined) update.active = body.active;

  const { error } = await supabase.from("interview_questions").update(update).eq("id", id);
  if (error) return Response.json({ error: "更新失敗" }, { status: 500 });

  // 問題文字有變更 → 重新生成譯文 + 音頻（失敗唔影響更新，但 warning 要透出俾用戶）
  let warning: string | undefined;
  if (body.question !== undefined) {
    try {
      const assets = await generateQuestionAssets(id, update.question as string);
      if (assets.warnings.length) warning = assets.warnings.join("\n\n");
    } catch (e) {
      console.error("[questions] 翻譯/語音生成失敗（不影響更新）:", e);
      warning = toUserMessage(e);
    }
  }
  return Response.json({ ok: true, ...(warning ? { warning } : {}) });
}

/** DELETE 刪除問題（硬刪除；已作答記錄有問題快照，不受影響） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });
  const { id } = await params;
  const { error } = await supabase.from("interview_questions").delete().eq("id", id);
  if (error) return Response.json({ error: "刪除失敗" }, { status: 500 });
  return Response.json({ ok: true });
}
