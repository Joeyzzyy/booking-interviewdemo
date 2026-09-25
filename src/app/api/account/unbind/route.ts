import { getSessionCustomer, isChannel, unbindChannel } from "@/lib/booking/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/unbind（需登入）
 * body: { channel } — 解綁電郵或手機；賬戶必須至少保留一種聯絡方式。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  let body: { channel?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const channel = body.channel;
  if (!isChannel(channel)) {
    return Response.json({ error: "不支持的方式" }, { status: 400 });
  }
  if (!customer[channel]) {
    return Response.json({ error: "該聯絡方式尚未綁定" }, { status: 400 });
  }

  const { customer: updated, error } = await unbindChannel(customer.id, channel);
  if (error || !updated) {
    return Response.json({ error: error || "解綁失敗" }, { status: 400 });
  }
  return Response.json({
    ok: true,
    customer: { id: updated.id, email: updated.email, phone: updated.phone },
  });
}
