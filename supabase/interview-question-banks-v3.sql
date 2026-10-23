-- ============================================================
-- 題庫 v3：Basic 50 題新劇本 + 測試章節評分制（rubric）+ DISC 選擇題
-- 執行位置：Supabase SQL Editor（正式庫）
-- 依賴：interview.sql / interview-advanced-v2.sql 已執行
-- ============================================================

-- 1) 題目評分標準（rubric jsonb）：
--    binary {kind,max,passKeys,failKeys} / scale {kind,max,bands} / choice {kind,options[]}
alter table public.interview_questions
  add column if not exists rubric jsonb;

-- 2) 面試 AI 評分結果
alter table public.interviews
  add column if not exists assessments jsonb not null default '[]'::jsonb;
-- assessments: [{section,title,total,max,tier,tierLabel,items[{question,answer,score,max,note}]},
--               {section:"disc",dominant,secondary,counts,label,description}]

-- 3) 舊 Basic 72 題下線（新版 50 題接替；歷史面試記錄 question_text 已快照，不受影響）
update public.interview_questions set active = false where customer_id is null
  and category in ('administrative','personal','skills','language','country',
                   'history','willingness','preferences','legal');

-- 4) 舊 Advanced 測試章節中被評分表取代嘅 5 章下線（elderly-care / basic-info 保留）
--    personality/ aptitude 由 comprehensive（綜合能力及性格測試）接替
update public.interview_questions set active = false where customer_id is null
  and category in ('personality','aptitude','infant-care','child-care',
                   'pet-care','housework-cooking');

comment on column public.interview_questions.rubric is '評分標準：binary(PASS/FAIL關鍵字) / scale(5/3/1分檔標準) / choice(DISC選項)';
comment on column public.interviews.assessments is 'AI 評分結果：章節總分+檔位+逐題評語 + DISC 性格分析';
