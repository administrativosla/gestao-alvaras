CREATE TABLE `alvara_pdfs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alvaraId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`pdfKey` varchar(500) NOT NULL,
	`pdfUrl` varchar(500) NOT NULL,
	`uploadedBy` varchar(255),
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alvara_pdfs_id` PRIMARY KEY(`id`)
);
