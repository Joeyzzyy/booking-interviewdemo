import { randomBytes } from "crypto";
import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { ADVANCED_SECTIONS } from "@/lib/interview/shared-questions";
import { getActiveSubscription } from "@/lib/interview/plans";

export const dynamic = "force-dynamic";

export const INTERVIEW_BUCKET = "interview-videos";

/** GET 當前用戶的面試列表 */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { data, error } = await supabase
    .from("interviews")
    .select("id, token, worker_name, status, report, plan, sections, cv, created_at, completed_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: "讀取失敗" }, { status: 500 });
  return Response.json({ interviews: data || [] });
}

/**
 * POST 發起面試（multipart/form-data，歸屬當前用戶）：
 * workerName + plan（basic|advanced，缺省 basic）+ sections（advanced 章節 key，逗號分隔，可選）
 * + resume（PDF/TXT 文件，可選）+ resumeText（可選，覆蓋提取結果）
 * 返回工人端連結 token。
 *
 * 付費門檻：需有效訂閱（Basic $199/月 / Advanced $399/月）；
 * advanced 計劃需要 advanced 訂閱，且簡歷非必填（自製 CV 唔使簡歷）。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  // ---- 訂閱校驗（AI 面試為付費功能） ----
  const subscription = await getActiveSubscription(customer.id);
  if (!subscription) {
    return Response.json(
      { error: "AI 面試為付費功能，請先訂閱 Basic（HK$199/月）或 Advanced（HK$399/月）計劃", code: "SUBSCRIPTION_REQUIRED" },
      { status: 402 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const workerName = String(form.get("workerName") || "").trim();
  if (!workerName) {
    return Response.json({ error: "請填寫工人姓名" }, { status: 400 });
  }

  // 計劃類型：advanced 需 advanced 訂閱
  const plan = form.get("plan") === "advanced" ? "advanced" : "basic";
  if (plan === "advanced" && subscription.plan !== "advanced") {
    return Response.json(
      { error: "自製 CV 面試需要 Advanced Plan（HK$399/月），請升級訂閱", code: "PLAN_UPGRADE_REQUIRED" },
      { status: 403 }
    );
  }

  // advanced 章節（缺省/空 = 全部 8 章）
  let sections: string[] | null = null;
  if (plan === "advanced") {
    const validKeys = new Set(ADVANCED_SECTIONS.map((s) => s.key));
    const raw = String(form.get("sections") || "");
    const picked = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => validKeys.has(s));
    sections = picked.length > 0 ? picked : ADVANCED_SECTIONS.map((s) => s.key);
  }

  let resumeText = String(form.get("resumeText") || "").trim();
  const resumeFile = form.get("resume");
  const hasResumeFile = resumeFile instanceof File && resumeFile.size > 0;
  // 簡歷必填：basic（核實 CV）冇簡歷無法做匹配分析；advanced（自製 CV）由問答生成 CV，簡歷可選
  if (plan === "basic" && !hasResumeFile && !resumeText) {
    return Response.json(
      { error: "請上傳工人簡歷（PDF/TXT）或貼上簡歷文字，沒有簡歷不能發起核實 CV 面試" },
      { status: 400 }
    );
  }
  let resumeFilePath: string | null = null;

  // 上傳簡歷原件 + 提取文字（PDF/TXT）
  if (hasResumeFile) {
    if (resumeFile.size > 4 * 1024 * 1024) {
      return Response.json({ error: "簡歷文件不能超過 4MB" }, { status: 400 });
    }
    const ext = resumeFile.name.split(".").pop()?.toLowerCase() || "bin";
    resumeFilePath = `resumes/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
    const buf = Buffer.from(await resumeFile.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .upload(resumeFilePath, buf, { contentType: resumeFile.type });
    if (upErr) {
      console.error("[interview] 簡歷上傳失敗:", upErr);
      return Response.json({ error: "簡歷上傳失敗" }, { status: 500 });
    }

    if (!resumeText) {
      if (ext === "txt") {
        resumeText = buf.toString("utf-8").slice(0, 20000);
      } else if (ext === "pdf") {
        try {
          const { extractText } = await import("unpdf");
          const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
          resumeText = String(text).slice(0, 20000);
        } catch (e) {
          console.error("[interview] PDF 提取失敗:", e);
        }
      }
    }
  }

  const token = randomBytes(16).toString("hex");
  const { data, error } = await supabase
    .from("interviews")
    .insert({
      token,
      worker_name: workerName,
      resume_text: resumeText || null,
      resume_file_path: resumeFilePath,
      customer_id: customer.id,
      plan,
      sections,
    })
    .select("id, token")
    .single();
  if (error || !data) {
    console.error("[interview] 創建面試失敗:", error);
    return Response.json({ error: "創建失敗" }, { status: 500 });
  }
  return Response.json({ token: data.token, id: data.id }, { status: 201 });
}
