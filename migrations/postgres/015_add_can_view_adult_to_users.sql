-- ============================================
-- 成人内容查看权限：users 表新增 can_view_adult 列
-- 0 = 不可看 AV（新用户默认），1 = 可看 AV
-- 站长（owner）与管理员（admin）在代码层始终视为允许，不依赖本列
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_adult INTEGER DEFAULT 0;
