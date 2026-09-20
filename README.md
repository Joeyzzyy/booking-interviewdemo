# Booking Demo & Interview Demo（服務預約 + 視頻面試）

獨立演示項目（淺色調通用 demo），包含：
- `/booking` 服務預約（套票制：先買後用，演示可領試用套票）
- `/admin` 管理後台（預約訂單管理 / 視頻面試 / 面試記錄，Ant Design）
- `/interview/<token>` 工人視頻面試（AI 轉寫 + 逐題判斷 + 整體報告）

## 啟動

```bash
npm install
npm run dev    # 端口 3000
npm run build && npm run start
```

## 環境變量

見 `.env.local.example`（Supabase / Resend / Gemini / ADMIN_PASSWORD 等）。

## 數據庫

表結構見 `supabase/`（需拷入 Supabase SQL Editor 執行）。
