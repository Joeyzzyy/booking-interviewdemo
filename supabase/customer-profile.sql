-- ============================================================
-- 客戶資料補全（註冊後、進入功能前必填）— 在 Supabase Dashboard → SQL Editor 執行
-- 申請人姓名 / 公司名稱 / 勞工處登記編號 / 身份證照片（存 booking-files 桶）
-- ============================================================

alter table customers
  add column if not exists applicant_name text,
  add column if not exists company_name text,
  add column if not exists labour_reg_no text,
  add column if not exists id_card_path text;
