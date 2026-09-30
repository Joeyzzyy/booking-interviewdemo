import { getSessionCustomer } from "@/lib/booking/auth";
import { parsePassport } from "@/lib/booking/passport-ocr";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "sin1"; // Gemini 對香港區域有限制，同面試模組

const ACCEPT = ["image/jpeg", "image/png", "application/pdf"];

/**
 * POST /api/bookings/parse-passport
 * multipart: file（護照相片/PDF，≤4MB）→ { workerName, passportNo }
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "請選擇護照檔案" }, { status: 400 });
  }
  if (!ACCEPT.includes(file.type)) {
    return Response.json({ error: "格式不支持（僅限 JPG/PNG/PDF）" }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return Response.json({ error: "檔案超過 4MB 上限，請壓縮或截圖後再上傳" }, { status: 400 });
  }

  try {
    const result = await parsePassport(Buffer.from(await file.arrayBuffer()), file.type);
    if (!result.workerName && !result.passportNo) {
      return Response.json({ error: "識別唔到護照資料，請手動輸入" }, { status: 422 });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[parse-passport]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "識別失敗，請手動輸入" },
      { status: 500 }
    );
  }
}
