# 傭易做 — 服務預約 + AI 視頻面試平台

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
- `/booking?tab=questions / create / records` 設置題庫、發起面試、查看記錄；**面試按用戶隔離**
- **公共題庫**：《DOMESTIC HELPER CV DATA COLLECTION INTERVIEW FORM》72 題（`customer_id IS NULL`），
  所有登入用戶可見、按 9 個章節分類展示，用戶側只讀；用戶可另加自定義問題，面試出題 = 公共題 + 自定義題
- `/interview/<token>` 工人端作答（免登入），按面試歸屬人的題庫出題（公共題排前，自定義題排後）
- **多語言**：題目新增/修改時自動翻譯 5 語（英/印尼/菲/普/粵）並生成 TTS 語音存儲；
  工人端可切換語言（全頁文案 + 題目語音播放，可反覆播放；題庫內可逐語言試聽）
- 資料表（`interview_questions` / `interviews` / `interview_answers`）與主站預約系統完全獨立，後續可隨時拆分成獨立服務

**後台（管理端，Ant Design）**
- `/admin` 預約訂單管理（視頻面試題庫/發起/記錄為前台功能，登入後於 `/booking` 使用）
- **密碼門禁**：進入 `/admin` 與調用 `/api/admin/*` 需先輸入管理密碼（環境變量 `ADMIN_PASSWORD`，未配置時默認 `admin@2026`，登入後 12 小時有效）

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
6. `supabase/interview-category.sql` — 題目分類欄位 `category`（公共題庫按章節分組）
7. `supabase/customer-profile.sql` — 用戶註冊資料補全 + 審核流
8. `supabase/board.sql` — 交流區帖子表 + 圖片公共桶
9. `supabase/forum-admin.sql` — 論壇管理員標記 + 帖子置頂

## 公共題庫導入（種子腳本）

執行完上述 SQL 後，導入《CV 數據采集面試表》72 題（含 5 語翻譯 + TTS 音頻）：

```bash
npm run seed:questions                 # 冪等，可反覆運行（已齊全的自動跳過）
npm run seed:questions -- --limit 3    # 只跑前 3 題（試跑）
npm run seed:questions -- --force      # 全部重新生成譯文 + 音頻
```

需要 `.env.local` 配置 Supabase 及 AI key（`MINIMAX_API_KEY` 或 `GEMINI_API_KEY`）。

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
