import { randomBytes } from "crypto";
import { getSessionCustomer, isProfileApproved } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

const BUCKET = process.env.BOARD_STORAGE_BUCKET || "board-images";
const ACCEPT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /api/board/upload — 帖子內嵌圖片上傳（公共桶，返回永久 URL）。
 * multipart: file（JPG/PNG/WebP/GIF ≤4MB），需登入且審核通過。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer || !isProfileApproved(customer)) {
    return Response.json({ error: "審核通過後先可以發帖" }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "請選擇圖片" }, { status: 400 });
  }
  const ext = ACCEPT[file.type];
  if (!ext) {
    return Response.json({ error: "格式不支持（僅限 JPG/PNG/WebP/GIF）" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return Response.json({ error: "圖片超過 4MB 上限，請壓縮後再上傳" }, { status: 400 });
  }

  const path = `${customer.id}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) {
    console.error("[board] 圖片上傳失敗:", error);
    return Response.json({ error: "上傳失敗，請稍後再試" }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}
