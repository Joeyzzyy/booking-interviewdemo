import { getSupabase, STORAGE_BUCKET, type Booking } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

export function checkAdminAuth(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD || "oneplus@2026";
  return request.headers.get("x-admin-auth") === password;
}

/**
 * GET /api/admin/bookings?status=pending|confirmed|rejected|cancelled|all
 * 訂單列表（需 x-admin-auth 頭）。文件附 1 小時 signed URL。
 */
export async function GET(request: Request) {
  if (!checkAdminAuth(request)) {
    return Response.json({ error: "未授權" }, { status: 401 });
  }
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
