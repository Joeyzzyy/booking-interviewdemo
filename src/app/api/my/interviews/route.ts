import { randomBytes } from "crypto";
import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

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
    .select("id, token, worker_name, status, report, created_at, completed_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: "讀取失敗" }, { status: 500 });
  return Response.json({ interviews: data || [] });
}

/**
 * POST 發起面試（multipart/form-data，歸屬當前用戶）：
 * workerName + resume（PDF/TXT 文件，可選）+ resumeText（可選，覆蓋提取結果）
 * 返回工人端連結 token。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

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
  let resumeText = String(form.get("resumeText") || "").trim();
  const resumeFile = form.get("resume");
  const hasResumeFile = resumeFile instanceof File && resumeFile.size > 0;
  // 簡歷必填：沒有簡歷，AI 無法做「簡歷 × 回答」匹配分析
  if (!hasResumeFile && !resumeText) {
    return Response.json(
      { error: "請上傳工人簡歷（PDF/TXT）或貼上簡歷文字，沒有簡歷不能發起面試" },
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
    })
    .select("id, token")
    .single();
  if (error || !data) {
    console.error("[interview] 創建面試失敗:", error);
    return Response.json({ error: "創建失敗" }, { status: 500 });
  }
  return Response.json({ token: data.token, id: data.id }, { status: 201 });
}
