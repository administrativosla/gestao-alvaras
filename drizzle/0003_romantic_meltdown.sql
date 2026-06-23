ALTER TABLE `alvaras` MODIFY COLUMN `status` varchar(50) NOT NULL DEFAULT 'Vencido';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('operator','gestor','master') NOT NULL DEFAULT 'operator';--> statement-breakpoint
ALTER TABLE `users` ADD `userStatus` enum('pending','active','blocked') DEFAULT 'pending' NOT NULL;