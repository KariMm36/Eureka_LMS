-- AlterTable: add tokenVersion to users for instant access token invalidation on logout
ALTER TABLE `users` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;
