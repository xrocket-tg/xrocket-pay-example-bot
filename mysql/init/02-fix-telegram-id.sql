-- Migration: Fix telegram_id columns to support larger Telegram user IDs
-- Date: 2025-06-27
-- Description: Change telegram_id columns from INT to BIGINT to support Telegram user IDs larger than 2.1 billion

-- Fix users table
ALTER TABLE `users` MODIFY COLUMN `telegram_id` BIGINT NOT NULL;

-- Fix user_transfers table
ALTER TABLE `user_transfers` MODIFY COLUMN `recipient_telegram_id` BIGINT NOT NULL;

-- Add indexes for better performance on telegram_id lookups
CREATE INDEX IF NOT EXISTS `idx_users_telegram_id` ON `users` (`telegram_id`);
CREATE INDEX IF NOT EXISTS `idx_user_transfers_recipient_telegram_id` ON `user_transfers` (`recipient_telegram_id`);

-- Verify the changes
DESCRIBE `users`;
DESCRIBE `user_transfers`; 