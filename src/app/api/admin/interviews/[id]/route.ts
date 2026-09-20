import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "../route";

export const dynamic = "force-dynamic";

/** GET 面試詳情：作答記錄（含視頻 signed URL）+ 報告 + 簡歷下載鏈接 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { id } = await params;
  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !interview) return Response.json({ error: "面試不存在" }, { status: 404 });

  const { data: answers } = await supabase
    .from("interview_answers")
    .select("*")
    .eq("interview_id", id)
    .order("created_at", { ascending: true });

  // 批量生成視頻/簡歷 signed URL（1 小時）
  const paths = [
    ...(answers || []).map((a) => a.video_path).filter(Boolean),
    interview.resume_file_path,
  ].filter(Boolean) as string[];
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .createSignedUrls(paths, 3600);
    for (const s of signed || []) {
      if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
    }
  }

  return Response.json({
    interview: {
      ...interview,
      resume_url: interview.resume_file_path ? urlMap.get(interview.resume_file_path) || null : null,
    },
    answers: (answers || []).map((a) => ({
      ...a,
      video_url: a.video_path ? urlMap.get(a.video_path) || null : null,
    })),
  });
}

/**
 * DELETE /api/admin/interviews/[id]
 * 刪除整場面試：作答記錄（級聯）、storage 視頻、簡歷原件、面試記錄。
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { id } = await params;
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, resume_file_path")
    .eq("id", id)
    .maybeSingle();
  if (!interview) return Response.json({ error: "面試不存在" }, { status: 404 });

  // 清理 storage：視頻目錄 + 簡歷原件
  const { data: files } = await supabase.storage
    .from(INTERVIEW_BUCKET)
    .list(`videos/${id}`, { limit: 100 });
  const paths = (files || []).map((f) => `videos/${id}/${f.name}`);
  if (interview.resume_file_path) paths.push(interview.resume_file_path);
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(INTERVIEW_BUCKET).remove(paths);
    if (rmErr) console.error("[interview] 清理存儲失敗:", rmErr);
  }

  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) {
    console.error("[interview] 刪除失敗:", error);
    return Response.json({ error: "刪除失敗" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
