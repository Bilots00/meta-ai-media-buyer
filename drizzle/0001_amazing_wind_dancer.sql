CREATE TABLE `ab_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`hypothesis` text,
	`variantAAdId` int,
	`variantBAdId` int,
	`status` enum('running','paused','completed','cancelled') NOT NULL DEFAULT 'running',
	`winnerVariant` varchar(4),
	`confidenceLevel` decimal(6,4),
	`statisticalSignificance` boolean DEFAULT false,
	`startDate` timestamp DEFAULT (now()),
	`endDate` timestamp,
	`conclusionNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ab_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`metaAdSetId` varchar(64),
	`name` varchar(255) NOT NULL,
	`status` enum('ACTIVE','PAUSED','DELETED','ARCHIVED') NOT NULL DEFAULT 'PAUSED',
	`dailyBudget` decimal(12,2),
	`bidStrategy` varchar(64) DEFAULT 'LOWEST_COST_WITHOUT_CAP',
	`billingEvent` varchar(64) DEFAULT 'IMPRESSIONS',
	`optimizationGoal` varchar(64) DEFAULT 'CONVERSIONS',
	`targeting` json,
	`startTime` timestamp,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adSetId` int NOT NULL,
	`metaAdId` varchar(64),
	`name` varchar(255) NOT NULL,
	`status` enum('ACTIVE','PAUSED','DELETED','ARCHIVED') NOT NULL DEFAULT 'PAUSED',
	`headline` text,
	`primaryText` text,
	`description` text,
	`callToAction` varchar(64) DEFAULT 'LEARN_MORE',
	`imageUrl` text,
	`videoUrl` text,
	`destinationUrl` text,
	`isAiGenerated` boolean DEFAULT false,
	`abTestGroup` varchar(8),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`goalId` int,
	`campaignId` int,
	`adId` int,
	`actionType` enum('audit','copy_generation','campaign_create','ad_activate','ad_pause','budget_increase','budget_decrease','budget_reallocate','ab_test_create','ab_test_evaluate','optimization','alert_triggered','goal_started','goal_completed','goal_failed','tracking_setup','disaster_recovery') NOT NULL,
	`title` varchar(255) NOT NULL,
	`reasoning` text,
	`actionDetails` json,
	`kpiBefore` json,
	`kpiAfter` json,
	`impact` enum('positive','neutral','negative','critical') DEFAULT 'neutral',
	`severity` enum('info','warning','error','critical') DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignId` int,
	`goalId` int,
	`alertType` enum('budget_anomaly','performance_drop','api_error','spend_limit_reached','cpa_spike','roas_drop','ad_rejected','account_disabled','goal_at_risk') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`details` json,
	`isRead` boolean DEFAULT false,
	`isResolved` boolean DEFAULT false,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaAccountId` int NOT NULL,
	`metaCampaignId` varchar(64),
	`name` varchar(255) NOT NULL,
	`objective` enum('OUTCOME_TRAFFIC','OUTCOME_LEADS','OUTCOME_SALES','OUTCOME_AWARENESS','OUTCOME_ENGAGEMENT','OUTCOME_APP_PROMOTION') NOT NULL,
	`status` enum('ACTIVE','PAUSED','DELETED','ARCHIVED','DRAFT') NOT NULL DEFAULT 'DRAFT',
	`dailyBudget` decimal(12,2),
	`lifetimeBudget` decimal(12,2),
	`budgetLimit` decimal(12,2),
	`startDate` timestamp,
	`endDate` timestamp,
	`specialAdCategory` varchar(64) DEFAULT 'NONE',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `copy_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignId` int,
	`prompt` text NOT NULL,
	`objective` varchar(255),
	`targetAudience` text,
	`productDescription` text,
	`tone` varchar(64) DEFAULT 'professional',
	`generatedHeadlines` json,
	`generatedPrimaryTexts` json,
	`generatedDescriptions` json,
	`selectedHeadline` text,
	`selectedPrimaryText` text,
	`selectedDescription` text,
	`usedInAdId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `copy_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`campaignId` int,
	`metaAccountId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`goalType` enum('leads','sales','registrations','traffic','awareness') NOT NULL,
	`targetValue` decimal(12,2) NOT NULL,
	`targetUnit` varchar(64) DEFAULT 'count',
	`budgetMax` decimal(12,2) NOT NULL,
	`budgetSpent` decimal(12,2) DEFAULT '0',
	`currentValue` decimal(12,2) DEFAULT '0',
	`status` enum('pending','running','paused','completed','failed') NOT NULL DEFAULT 'pending',
	`agentRunning` boolean DEFAULT false,
	`agentStartedAt` timestamp,
	`agentStoppedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaAccountId` int,
	`campaignId` int,
	`adId` int,
	`snapshotDate` timestamp NOT NULL,
	`impressions` bigint DEFAULT 0,
	`clicks` bigint DEFAULT 0,
	`spend` decimal(12,2) DEFAULT '0',
	`conversions` int DEFAULT 0,
	`leads` int DEFAULT 0,
	`reach` bigint DEFAULT 0,
	`frequency` decimal(8,4) DEFAULT '0',
	`ctr` decimal(8,4) DEFAULT '0',
	`cpc` decimal(10,4) DEFAULT '0',
	`cpm` decimal(10,4) DEFAULT '0',
	`cpa` decimal(10,4) DEFAULT '0',
	`cpl` decimal(10,4) DEFAULT '0',
	`roas` decimal(10,4) DEFAULT '0',
	`conversionRate` decimal(8,4) DEFAULT '0',
	`revenue` decimal(12,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpi_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`accountName` varchar(255),
	`accessToken` text,
	`tokenExpiresAt` timestamp,
	`currency` varchar(8) DEFAULT 'EUR',
	`timezone` varchar(64) DEFAULT 'Europe/Rome',
	`status` enum('active','disconnected','error') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracking_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metaAccountId` int NOT NULL,
	`pixelId` varchar(64),
	`pixelName` varchar(255),
	`pixelInstalled` boolean DEFAULT false,
	`pixelVerifiedAt` timestamp,
	`capiEnabled` boolean DEFAULT false,
	`capiAccessToken` text,
	`capiTestEventCode` varchar(64),
	`websiteUrl` text,
	`trackedEvents` json,
	`lastVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracking_configs_id` PRIMARY KEY(`id`)
);
