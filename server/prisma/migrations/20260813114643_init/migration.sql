-- CreateTable
CREATE TABLE `Admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Admin_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `expectedStudentCount` INTEGER NOT NULL,
    `publicToken` VARCHAR(64) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'GROUPED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_publicToken_key`(`publicToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slotsPerGroup` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,

    INDEX `RoleDefinition_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `RoleDefinition_sessionId_name_key`(`sessionId`, `name`),
    UNIQUE INDEX `RoleDefinition_sessionId_position_key`(`sessionId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Student` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `roleId` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Student_sessionId_roleId_idx`(`sessionId`, `roleId`),
    UNIQUE INDEX `Student_sessionId_name_key`(`sessionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GeneratedGroup_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `GeneratedGroup_sessionId_position_key`(`sessionId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `roleId` INTEGER NOT NULL,

    UNIQUE INDEX `GroupMember_studentId_key`(`studentId`),
    INDEX `GroupMember_groupId_idx`(`groupId`),
    INDEX `GroupMember_roleId_idx`(`roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoleDefinition` ADD CONSTRAINT `RoleDefinition_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `RoleDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedGroup` ADD CONSTRAINT `GeneratedGroup_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `GeneratedGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `RoleDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
