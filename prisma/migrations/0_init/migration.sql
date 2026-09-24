-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('FOREMAN', 'PROJECT_MANAGER', 'SENIOR_MANAGER', 'OFFICE', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('EN', 'ES');

-- CreateEnum
CREATE TYPE "public"."IdentityCheck" AS ENUM ('PHONE_LAST4', 'SSN_LAST4');

-- CreateEnum
CREATE TYPE "public"."SideStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "public"."ReviewStatus" AS ENUM ('OPEN', 'PENDING_OFFICE', 'SENT_BACK', 'APPROVED', 'DISCUSSED', 'SIGN_LINK_SENT', 'SIGNED', 'DECLINED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."AnswerSide" AS ENUM ('EMPLOYEE', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "public"."LinkKind" AS ENUM ('SELF_EVAL', 'SIGN');

-- CreateEnum
CREATE TYPE "public"."MessageChannel" AS ENUM ('SMS', 'EMAIL', 'HANDOFF', 'MANUAL');

-- CreateTable
CREATE TABLE "public"."CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'eci',
    "name" TEXT NOT NULL DEFAULT 'Electrical Contractor Inc.',
    "shortName" TEXT NOT NULL DEFAULT 'ECI',
    "identityCheck" "public"."IdentityCheck" NOT NULL DEFAULT 'PHONE_LAST4',
    "linkTtlDays" INTEGER NOT NULL DEFAULT 7,
    "linkMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderEmployeeDays" INTEGER NOT NULL DEFAULT 3,
    "reminderSupervisorDays" INTEGER NOT NULL DEFAULT 7,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "reminderQuietStartHour" INTEGER NOT NULL DEFAULT 8,
    "reminderQuietEndHour" INTEGER NOT NULL DEFAULT 21,
    "twilioAccountSid" TEXT,
    "twilioAuthTokenEnc" TEXT,
    "twilioFromNumber" TEXT,
    "graphTenantId" TEXT,
    "graphClientId" TEXT,
    "graphSender" TEXT,
    "graphClientSecretEnc" TEXT,
    "graphCertificatePemEnc" TEXT,
    "graphPrivateKeyPemEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "roles" "public"."Role"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneLast4" TEXT,
    "ssnLast4Hash" TEXT,
    "email" TEXT,
    "position" TEXT NOT NULL,
    "iecStatus" TEXT,
    "hireDate" TIMESTAMP(3),
    "jobSite" TEXT,
    "language" "public"."Language" NOT NULL DEFAULT 'EN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReviewTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TemplateCriterion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelEs" TEXT NOT NULL,

    CONSTRAINT "TemplateCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TemplateQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "textEs" TEXT NOT NULL,

    CONSTRAINT "TemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "language" "public"."Language" NOT NULL DEFAULT 'EN',
    "status" "public"."ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "supervisorStatus" "public"."SideStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "employeeStatus" "public"."SideStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "overallRating" INTEGER,
    "overallComments" TEXT,
    "goals" TEXT,
    "employeeComments" TEXT,
    "supervisorSubmittedAt" TIMESTAMP(3),
    "employeeSubmittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "sentBackReason" TEXT,
    "sentBackAt" TIMESTAMP(3),
    "discussedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewAnswer" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "side" "public"."AnswerSide" NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewQuestionAnswer" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewLink" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "kind" "public"."LinkKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "channel" "public"."MessageChannel" NOT NULL,
    "sentTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Signature" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "typedName" TEXT NOT NULL,
    "imageData" TEXT,
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "declineComment" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OfficeNote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayBlock" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "currentPayRate" DECIMAL(10,2),
    "lastReviewDate" TIMESTAMP(3),
    "lastRaiseDate" TIMESTAMP(3),
    "lastRaiseAmount" DECIMAL(10,2),
    "raiseAmount" DECIMAL(10,2),
    "newPayRate" DECIMAL(10,2),
    "dateEffective" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "firstFailureAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."ConsumedLoginToken" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumedLoginToken_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageLog" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT,
    "employeeId" TEXT,
    "channel" "public"."MessageChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "providerId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "public"."Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTemplate_key_key" ON "public"."ReviewTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateCriterion_templateId_sortOrder_key" ON "public"."TemplateCriterion"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateQuestion_templateId_sortOrder_key" ON "public"."TemplateQuestion"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "Review_supervisorId_status_idx" ON "public"."Review"("supervisorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_periodId_employeeId_key" ON "public"."Review"("periodId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAnswer_reviewId_criterionId_side_key" ON "public"."ReviewAnswer"("reviewId", "criterionId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQuestionAnswer_reviewId_questionId_key" ON "public"."ReviewQuestionAnswer"("reviewId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewLink_tokenHash_key" ON "public"."ReviewLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ReviewLink_reviewId_kind_idx" ON "public"."ReviewLink"("reviewId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_reviewId_key" ON "public"."Signature"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "PayBlock_reviewId_key" ON "public"."PayBlock"("reviewId");

-- CreateIndex
CREATE INDEX "ConsumedLoginToken_expiresAt_idx" ON "public"."ConsumedLoginToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_reviewId_createdAt_idx" ON "public"."AuditEvent"("reviewId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ReviewTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TemplateCriterion" ADD CONSTRAINT "TemplateCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ReviewTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TemplateQuestion" ADD CONSTRAINT "TemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ReviewTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."ReviewPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ReviewTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewAnswer" ADD CONSTRAINT "ReviewAnswer_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewAnswer" ADD CONSTRAINT "ReviewAnswer_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "public"."TemplateCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewQuestionAnswer" ADD CONSTRAINT "ReviewQuestionAnswer_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewQuestionAnswer" ADD CONSTRAINT "ReviewQuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."TemplateQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewLink" ADD CONSTRAINT "ReviewLink_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewLink" ADD CONSTRAINT "ReviewLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signature" ADD CONSTRAINT "Signature_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OfficeNote" ADD CONSTRAINT "OfficeNote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OfficeNote" ADD CONSTRAINT "OfficeNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayBlock" ADD CONSTRAINT "PayBlock_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayBlock" ADD CONSTRAINT "PayBlock_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageLog" ADD CONSTRAINT "MessageLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

