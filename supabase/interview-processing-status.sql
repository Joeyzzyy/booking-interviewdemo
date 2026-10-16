-- interviews.status 增加 'processing'：視頻已提交、AI 後台解析中的中間態
-- 狀態流轉：pending → in_progress → processing（已提交，後台解析中）→ completed
alter table interviews drop constraint if exists interviews_status_check;
alter table interviews add constraint interviews_status_check
  check (status in ('pending','in_progress','processing','completed'));
