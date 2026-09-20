import { getSupabase, STORAGE_BUCKET, type Booking } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bookings?status=pending|confirmed|rejected|cancelled|all
 * 訂單列表。文件附 1 小時 signed URL。
 */
export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "數據庫未配置" }, { status: 503 });
  }

  const status = new URL(request.url).searchParams.get("status");
  let query = supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[admin] 讀取訂單失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }

  const bookings = (data || []) as Booking[];

  // 為所有文件批量生成 signed URL（1 小時有效）
  const paths = bookings.flatMap((b) => (b.files || []).map((f) => f.path));
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, 3600);
    for (const s of signed || []) {
      if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
    }
  }

  return Response.json({
    bookings: bookings.map((b) => ({
      ...b,
      files: (b.files || []).map((f) => ({ ...f, url: urlMap.get(f.path) || null })),
    })),
  });
}
