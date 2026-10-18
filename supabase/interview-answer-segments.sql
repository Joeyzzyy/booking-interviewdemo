-- interview_answers 增加整場錄製模式嘅定位欄位：
-- audio_path  : 從整場 WAV 切出嘅該題音頻段（storage 路徑，可空）
-- video_start / video_end : 該題回答在整場視頻中的起止秒數（可空）
-- 舊數據（逐題錄製）三列為 null，不受影響。
alter table interview_answers
  add column if not exists audio_path text,
  add column if not exists video_start integer,
  add column if not exists video_end integer;
