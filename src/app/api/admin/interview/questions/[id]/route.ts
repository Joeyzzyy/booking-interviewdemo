import { checkAdminAuth } from "@/app/api/admin/bookings/route";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** PUT 更新問題 { question?, focus?, sortOrder?, active? } */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminAuth(request)) return Response.json({ error: "未授權" }, { status: 401 });
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
  return Response.json({ ok: true });
}

/** DELETE 刪除問題（硬刪除；已作答記錄有問題快照，不受影響） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminAuth(request)) return Response.json({ error: "未授權" }, { status: 401 });
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });
  const { id } = await params;
  const { error } = await supabase.from("interview_questions").delete().eq("id", id);
  if (error) return Response.json({ error: "刪除失敗" }, { status: 500 });
  return Response.json({ ok: true });
}
