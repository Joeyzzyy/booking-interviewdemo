# 傭易做 — 服務預約 + AI 視頻面試平台

品牌概念：**Link・連結**（靛藍 `#4f46e5` → 青 `#06b6d4` 漸變，雙環相扣 logo）。

## 功能

**前台（用戶端）**
- `/` 品牌首頁（Hero / 服務項目 / 服務流程 / AI 面試介紹 / 關於 / CTA）
- `/login` 電郵 **或** 手機短訊驗證碼登入（首次登入即自動註冊）
- `/account` 賬號中心：綁定 / 解綁電郵與手機號（**必須至少保留一種**，暫不支援註銷賬戶）
- `/booking` 服務預約（按次購買套票：我的套票 / 購買套票 / 發起預約）

**服務及收費（HKD）**（配置見 `src/lib/booking/services.ts`，code-as-config 單一數據源）
- 工人接機 $300/次（接機時段只設 11:00 / 15:00 兩個選擇）
- 驗身 + 接機 $550/次（驗身報告經 WhatsApp 發送）
- 上門 Settlement（接走姐姐）$1000/次（車費另計）
- 印尼護士上門培訓 $500/小時起
- On Job Training（煮飯 / 清潔）$700/小時（4 小時起計）
- Boarding House（工人宿舍）$100/晚

**前台（用戶端）**
- `/` 品牌首頁
- 登入彈窗（全站任意位置觸發）/ `/login` 深鏈回退
- `/account` 賬號中心：綁定 / 解綁電郵與手機號（至少保留一種，暫不支援註銷）
- `/booking` 預約工作台：發起預約 / 我的套票（餘額+購買）/ 我的預約 / AI 面試（付費訂閱）

**AI 視頻面試（月費訂閱制，Stripe subscription）**
- **Basic Plan（核實 CV）HK$199/月**：72 題 CV 核實面試 + AI 簡歷匹配報告 + 逐題轉寫回放
- **Advanced Plan（自製 CV）HK$399/月**：**70 題全方位審查表實時逐題面試**（11 章：個人紀錄／家庭背景及思鄉風險／財政規劃／工作意向／前僱主動態迴圈／一般諮詢 12 題／健康查核／社交媒體規矩／誠信審查／興趣／作品照片）+ **AI 生成十一 章審查表 CV（可下載）** + 作品照片上傳；可按需附加 8 大測試章節（性格/IQ・AQ・EQ・記憶/長者照顧/寵物/家務烹飪/小童及青少年/嬰幼兒，64 題）
- 訂閱狀態 Stripe webhook 同步（`subscriptions` 表，`supabase/interview-plans.sql`）；升級自動取消舊訂閱；取消於本期結束時失效
- Advanced v2 遷移：`supabase/interview-advanced-v2.sql`（`interviews.mode` 面試模式 + `interviews.photos` 作品照片 + `interview_answers.attempt` 放寬到 4 供前僱主迴圈）
- 無訂閱用戶於 `/booking` AI 面試分頁看到方案卡片；`POST /api/my/interviews` 無有效訂閱返回 402
- `/booking?tab=questions / create / records` 設置題庫、發起面試、查看記錄；**面試按用戶隔離**
- **公共題庫**：《DOMESTIC HELPER CV DATA COLLECTION INTERVIEW FORM》72 題（Basic，9 章節）+ Advanced v2 主體審查表 70 題（11 章節，`adv-*`）+ Advanced 測試 64 題（8 章節）（`customer_id IS NULL`），
  用戶側只讀；用戶可另加自定義問題；Basic 面試出 Basic 題庫 + 自定義題，Advanced 面試出 70 題主體 + 勾選測試章節 + 自定義題
- `/interview/<token>` 工人端作答（免登入）
- **作答流程（Basic / 舊面試：連續錄製）**：設備檢查（強制鏡頭開啟 + 咪高峰音量條/3 秒試錄回放）→ 全程一次連續錄製（鏡頭不關、畫中畫預覽）→ 自由「上一題/下一題」切換作答 → 結束統一提交；後端整段轉寫 → LLM 按題切分回答 → 生成整體報告
- **作答流程（Advanced v2：實時逐題）**：問一題錄一題（單題上限 90 秒）→ 即場轉寫落庫 → 自動下一題；答完「前僱主總數」題後按所選數量（0–4）動態展開每位僱主 6 條追問（TTS 複用模板音頻）；全部答完進入作品照片上傳步驟（2–3 張煮菜照 + 1–2 張工作照）→ 提交後 AI 生成報告 + 十一 章審查表 CV
- **多語言**：題目新增/修改時自動翻譯 5 語（英/印尼/菲/普/粵）並生成 TTS 語音存儲；
  工人端可切換語言（全頁文案 + 題目語音播放，可反覆播放；題庫內可逐語言試聽）
- 題庫種子：`npm run seed:questions`（`--set advanced` 只種 Advanced 64 題；`--set core70` 只種 Advanced v2 主體 70 題；`--force` 重生成譯文/TTS）
- 資料表（`interview_questions` / `interviews` / `interview_answers` / `subscriptions`）與主站預約系統完全獨立，後續可隨時拆分成獨立服務

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
