-- ============================================================
-- AI 視頻面試：題目多語言（翻譯 + TTS 語音）
-- 冪等，可重複執行。
-- ============================================================
-- interview_questions 新增：
--   translations jsonb：{ en, id, tl, yue, zh } 各語言題目文字
--   audio        jsonb：{ en, id, tl, yue, zh } 各語言 TTS 音頻在 storage 的路徑
-- 音頻存於 interview-videos bucket 的 tts/<questionId>/<lang>.wav

alter table interview_questions
  add column if not exists translations jsonb not null default '{}'::jsonb;
alter table interview_questions
  add column if not exists audio jsonb not null default '{}'::jsonb;
