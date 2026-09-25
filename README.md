# NEXUSLINK SERVICES LIMITED — 服務預約 + AI 視頻面試平台

品牌概念：**Link・連結**（靛藍 `#4f46e5` → 青 `#06b6d4` 漸變，雙環相扣 logo）。

## 功能

**前台（用戶端）**
- `/` 品牌首頁（Hero / 服務項目 / 服務流程 / AI 面試介紹 / 關於 / CTA）
- `/login` 電郵 **或** 手機短訊驗證碼登入（首次登入即自動註冊）
- `/account` 賬號中心：綁定 / 解綁電郵與手機號（**必須至少保留一種**，暫不支援註銷賬戶）
- `/booking` 服務預約（套票制：我的套票 / 購買套票 / 發起預約，演示可領試用套票）

**前台（用戶端）**
- `/` 品牌首頁
- 登入彈窗（全站任意位置觸發）/ `/login` 深鏈回退
- `/account` 賬號中心：綁定 / 解綁電郵與手機號（至少保留一種，暫不支援註銷）
- `/booking` 預約工作台：發起預約 / 我的套票（餘額+購買）/ 我的預約 / AI 面試（Beta）

**AI 視頻面試（Beta，所有登入用戶可用）**
- `/booking?tab=questions / create / records` 設置題庫、發起面試、查看記錄；**題庫與面試按用戶隔離**
- `/interview/<token>` 工人端作答（免登入），按面試歸屬人的題庫出題
- **多語言**：題目新增/修改時自動翻譯 4 語（英/印尼/菲/普）並生成 Gemini TTS 語音存儲；
  工人端可切換語言（全頁文案 + 題目語音播放，可反覆播放；題庫內可逐語言試聽）
- 資料表（`interview_questions` / `interviews` / `interview_answers`）與主站預約系統完全獨立，後續可隨時拆分成獨立服務

**後台（管理端，Ant Design）**
- `/admin` 預約訂單管理 / 視頻面試（共用示範題庫）/ 面試記錄

## 啟動

```bash
npm install
npm run dev    # 端口 3000
npm run build && npm run start
```

## 數據庫（Supabase）

依次在 Supabase Dashboard → SQL Editor 執行：

1. `supabase/booking-system.sql` — 基礎預約/套票表
2. `supabase/interview.sql` — 面試題庫/記錄表
3. `supabase/auth-upgrade.sql` — customers 加 `phone`、email 允許 NULL、通用驗證碼表 `otp_codes`
4. `supabase/interview-ownership.sql` — 面試題庫/面試按用戶隔離（`customer_id`）
5. `supabase/interview-i18n.sql` — 題目多語言：`translations` / `audio` 欄位（5 語翻譯 + TTS 語音）

## 環境變量

見 `.env.local.example`。重點：

- **電郵通道**：`RESEND_API_KEY`（未配置時開發環境直接返回 devCode 顯示在頁面）
- **短訊通道**：`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`
  （未配置時同上降級；要接其他供應商，改 `src/lib/booking/sms.ts` 即可）

## 主要目錄

```
src/
├─ app/
│  ├─ page.tsx              # 品牌首頁
│  ├─ (site)/               # 帶導航頁腳的站點頁：login / account / booking
│  ├─ admin/                # 管理後台（antd）
│  ├─ interview/[token]/    # 工人端視頻面試
│  └─ api/                  # auth / account / bookings / passes / admin / interview / stripe
├─ components/
│  ├─ brand/                # Logo / SiteHeader / SiteFooter / SectionHeader / Reveal / GlassGlow
│  ├─ home/                 # 首頁各區塊
│  └─ ui/                   # lighthare 風格 UI kit（Button/Input/Tabs/Modal/Badge）
└─ lib/
   ├─ brand.ts              # 品牌常量（VI）
   └─ booking/              # auth（OTP+綁定）/ sms / email / stripe / passes / services
```
