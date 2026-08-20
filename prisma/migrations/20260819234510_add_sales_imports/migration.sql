-- CreateEnum
CREATE TYPE "ImportReportType" AS ENUM ('SALES', 'FINANCE', 'INVENTORY');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'PARTIALLY_PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportedRowStatus" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'DUPLICATE', 'ERROR', 'COMMITTED');

-- CreateEnum
CREATE TYPE "FinancialEventType" AS ENUM ('PRODUCT_REVENUE', 'REFERRAL_FEE', 'FBA_FULFILLMENT_FEE', 'OTHER_FEE', 'REFUND', 'REFUND_FEE_CREDIT', 'REIMBURSEMENT', 'PROMOTION', 'TAX', 'ADJUSTMENT', 'OTHER');

-- AlterTable
ALTER TABLE "consumption_events" ADD COLUMN     "saleItemId" TEXT;

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "reportType" "ImportReportType" NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "filename" TEXT NOT NULL,
    "originalRowCount" INTEGER,
    "matchedRowCount" INTEGER,
    "unmatchedRowCount" INTEGER,
    "errorRowCount" INTEGER,
    "duplicateRowCount" INTEGER,
    "notes" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'FILE_IMPORT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_rows" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "reportType" "ImportReportType" NOT NULL,
    "rowNumber" INTEGER,
    "rawData" JSONB NOT NULL,
    "status" "ImportedRowStatus" NOT NULL DEFAULT 'PENDING',
    "matchedProductId" TEXT,
    "sourceRowKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "marketplaceId" TEXT,
    "importBatchId" TEXT,
    "externalOrderId" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'FILE_IMPORT',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitSellingPrice" DECIMAL(12,4),
    "lineItemSubtotal" DECIMAL(12,4),
    "externalLineItemId" TEXT,
    "importedRowId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_financial_events" (
    "id" TEXT NOT NULL,
    "saleId" TEXT,
    "saleItemId" TEXT,
    "productId" TEXT,
    "importBatchId" TEXT,
    "importedRowId" TEXT,
    "eventType" "FinancialEventType" NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "externalEventId" TEXT,
    "importFingerprint" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'FILE_IMPORT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_financial_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "imported_rows_importBatchId_idx" ON "imported_rows"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "imported_rows_reportType_sourceRowKey_key" ON "imported_rows"("reportType", "sourceRowKey");

-- CreateIndex
CREATE UNIQUE INDEX "sales_externalOrderId_key" ON "sales"("externalOrderId");

-- CreateIndex
CREATE INDEX "sales_importBatchId_idx" ON "sales"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_externalLineItemId_key" ON "sale_items"("externalLineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_importedRowId_key" ON "sale_items"("importedRowId");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "sale_financial_events_saleId_idx" ON "sale_financial_events"("saleId");

-- CreateIndex
CREATE INDEX "sale_financial_events_saleItemId_idx" ON "sale_financial_events"("saleItemId");

-- CreateIndex
CREATE INDEX "sale_financial_events_productId_idx" ON "sale_financial_events"("productId");

-- CreateIndex
CREATE INDEX "sale_financial_events_externalEventId_idx" ON "sale_financial_events"("externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_financial_events_importFingerprint_key" ON "sale_financial_events"("importFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "consumption_events_saleItemId_key" ON "consumption_events"("saleItemId");

-- AddForeignKey
ALTER TABLE "consumption_events" ADD CONSTRAINT "consumption_events_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_rows" ADD CONSTRAINT "imported_rows_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_rows" ADD CONSTRAINT "imported_rows_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "imported_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_financial_events" ADD CONSTRAINT "sale_financial_events_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_financial_events" ADD CONSTRAINT "sale_financial_events_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_financial_events" ADD CONSTRAINT "sale_financial_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_financial_events" ADD CONSTRAINT "sale_financial_events_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_financial_events" ADD CONSTRAINT "sale_financial_events_importedRowId_fkey" FOREIGN KEY ("importedRowId") REFERENCES "imported_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
