import { randomBytes } from "crypto";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

export const INTERVIEW_BUCKET = "interview-videos";

/** GET 面試列表（含每場作答題數統計） */
export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });
  const { data, error } = await supabase
    .from("interviews")
    .select("id, token, worker_name, status, report, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: "讀取失敗" }, { status: 500 });
  return Response.json({ interviews: data || [] });
}

/**
 * POST 發起面試（multipart/form-data）：
 * workerName + resume（PDF/TXT 文件，可選）+ resumeText（可選，覆蓋提取結果）
 * 返回工人端連結 token。
 */
export async function POST(request: Request) {
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
  let resumeFilePath: string | null = null;

  // 上傳簡歷原件 + 提取文字（PDF/TXT）
  if (resumeFile instanceof File && resumeFile.size > 0) {
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
    .insert({ token, worker_name: workerName, resume_text: resumeText || null, resume_file_path: resumeFilePath })
    .select("id, token")
    .single();
  if (error || !data) {
    console.error("[interview] 創建面試失敗:", error);
    return Response.json({ error: "創建失敗" }, { status: 500 });
  }
  return Response.json({ token: data.token, id: data.id }, { status: 201 });
}
