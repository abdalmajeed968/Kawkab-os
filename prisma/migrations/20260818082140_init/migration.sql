-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_APPLICABLE', 'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'CORRECT', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'PERMISSION_DENIED');

-- CreateEnum
CREATE TYPE "BoxMovementType" AS ENUM ('PURCHASE', 'SHIPMENT_USE', 'MANUAL_ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "BrandActivityType" AS ENUM ('EMAIL', 'CALL', 'MEETING', 'NOTE');

-- CreateEnum
CREATE TYPE "BrandRelationshipStatus" AS ENUM ('NOT_CONTACTED', 'IN_CONTACT', 'NEGOTIATING', 'PARTNERED', 'DECLINED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CompletenessStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "ConsumptionEventType" AS ENUM ('MANUAL_SALE', 'MANUAL_ADJUSTMENT', 'SHIPMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'RECEIPT', 'PACKING_SLIP', 'SHIPPING_DOCUMENT', 'CREDIT_MEMO', 'SUPPLIER_EMAIL', 'AMAZON_DOCUMENT', 'BUSINESS_REGISTRATION', 'EIN_LETTER', 'RESALE_CERTIFICATE', 'BRAND_APPROVAL_DOCUMENT', 'TAX_DOCUMENT', 'INSURANCE_DOCUMENT', 'SUPPLIER_AGREEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('UNKNOWN', 'OPEN', 'RESTRICTED', 'WORTH_UNLOCKING');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('UNKNOWN', 'FBA', 'FBM');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('ASIN', 'FNSKU', 'UPC', 'EAN', 'GTIN', 'MPN', 'INTERNAL_SKU');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NOT_APPLICABLE', 'UNMATCHED', 'MATCHED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('IDEA', 'CHECKING', 'VIABLE', 'NOT_VIABLE', 'SOURCING', 'TESTING', 'ADOPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShipmentDestinationType" AS ENUM ('AMAZON_FBA', 'CUSTOMER_DIRECT', 'THIRD_PARTY_WAREHOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'AI_EXTRACTED', 'SP_API', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'OPERATOR', 'AI_AGENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NEEDS_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_consumptions" (
    "id" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "consumptionEventId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPurchaseCost" DECIMAL(12,4) NOT NULL,
    "landedUnitCost" DECIMAL(12,4),
    "costCompletenessStatus" "CompletenessStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "box_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "boxMovementId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "box_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "box_movements" (
    "id" TEXT NOT NULL,
    "boxTypeId" TEXT NOT NULL,
    "type" "BoxMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,4),
    "invoiceNumber" TEXT,
    "shipmentId" TEXT,
    "notes" TEXT,
    "reversesMovementId" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "box_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "box_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lengthCm" DECIMAL(8,2),
    "widthCm" DECIMAL(8,2),
    "heightCm" DECIMAL(8,2),
    "weightCapacityKg" DECIMAL(8,2),
    "supplierId" TEXT,
    "lowStockThreshold" INTEGER,
    "notes" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "box_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_activities" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "BrandActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "followUpDate" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_contacts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "brand_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "supplierId" TEXT,
    "relationshipStatus" "BrandRelationshipStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_record_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "businessRecordId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "business_record_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_records" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "documentNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibleToOperator" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" TEXT NOT NULL,
    "businessName" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_events" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ConsumptionEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "reversesEventId" TEXT,
    "shipmentId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumption_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "type" "DocumentType" NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiExtractedFields" JSONB,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplaces" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "product_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_eligibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "EligibilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "approvalNotes" TEXT,
    "potentialSupplierId" TEXT,
    "invoicePathNotes" TEXT,
    "targetBuyPrice" DECIMAL(12,4),
    "ownerNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_identifiers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketplaceId" TEXT,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "product_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "brandId" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "purchase_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineItemCost" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceTotal" DECIMAL(12,4) NOT NULL,
    "tax" DECIMAL(12,4),
    "discount" DECIMAL(12,4),
    "supplierShipping" DECIMAL(12,4),
    "localShipping" DECIMAL(12,4),
    "prepCost" DECIMAL(12,4),
    "packagingCost" DECIMAL(12,4),
    "otherCost" DECIMAL(12,4),
    "notes" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "completenessStatus" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "researchEntryId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "research_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "asin" TEXT,
    "sku" TEXT,
    "productId" TEXT,
    "supplierId" TEXT,
    "assumedCost" DECIMAL(12,4),
    "assumedSellingPrice" DECIMAL(12,4),
    "competitionNotes" TEXT,
    "restrictionNotes" TEXT,
    "status" "ResearchStatus" NOT NULL DEFAULT 'IDEA',
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_boxes" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "boxTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_documents" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "role" "DocumentType" NOT NULL,

    CONSTRAINT "shipment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "destinationType" "ShipmentDestinationType" NOT NULL DEFAULT 'OTHER',
    "destinationName" TEXT,
    "marketplaceId" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "shipDate" TIMESTAMP(3),
    "deliveredDate" TIMESTAMP(3),
    "shippingCost" DECIMAL(12,4),
    "prepCost" DECIMAL(12,4),
    "notes" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "completenessStatus" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "batch_consumptions_consumptionEventId_idx" ON "batch_consumptions"("consumptionEventId" ASC);

-- CreateIndex
CREATE INDEX "batch_consumptions_purchaseItemId_idx" ON "batch_consumptions"("purchaseItemId" ASC);

-- CreateIndex
CREATE INDEX "box_documents_boxMovementId_idx" ON "box_documents"("boxMovementId" ASC);

-- CreateIndex
CREATE INDEX "box_movements_boxTypeId_idx" ON "box_movements"("boxTypeId" ASC);

-- CreateIndex
CREATE INDEX "brand_activities_brandId_idx" ON "brand_activities"("brandId" ASC);

-- CreateIndex
CREATE INDEX "brand_contacts_brandId_idx" ON "brand_contacts"("brandId" ASC);

-- CreateIndex
CREATE INDEX "brand_documents_brandId_idx" ON "brand_documents"("brandId" ASC);

-- CreateIndex
CREATE INDEX "business_record_documents_businessRecordId_idx" ON "business_record_documents"("businessRecordId" ASC);

-- CreateIndex
CREATE INDEX "consumption_events_productId_idx" ON "consumption_events"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "marketplaces_code_key" ON "marketplaces"("code" ASC);

-- CreateIndex
CREATE INDEX "product_documents_productId_idx" ON "product_documents"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_eligibility_productId_key" ON "product_eligibility"("productId" ASC);

-- CreateIndex
CREATE INDEX "product_identifiers_productId_idx" ON "product_identifiers"("productId" ASC);

-- CreateIndex
CREATE INDEX "product_identifiers_type_value_idx" ON "product_identifiers"("type" ASC, "value" ASC);

-- CreateIndex
CREATE INDEX "purchase_documents_purchaseId_idx" ON "purchase_documents"("purchaseId" ASC);

-- CreateIndex
CREATE INDEX "purchase_items_productId_idx" ON "purchase_items"("productId" ASC);

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId" ASC);

-- CreateIndex
CREATE INDEX "purchases_supplierId_idx" ON "purchases"("supplierId" ASC);

-- CreateIndex
CREATE INDEX "research_documents_researchEntryId_idx" ON "research_documents"("researchEntryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "shipment_boxes_shipmentId_idx" ON "shipment_boxes"("shipmentId" ASC);

-- CreateIndex
CREATE INDEX "shipment_documents_shipmentId_idx" ON "shipment_documents"("shipmentId" ASC);

-- CreateIndex
CREATE INDEX "shipment_items_productId_idx" ON "shipment_items"("productId" ASC);

-- CreateIndex
CREATE INDEX "shipment_items_shipmentId_idx" ON "shipment_items"("shipmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_consumptions" ADD CONSTRAINT "batch_consumptions_consumptionEventId_fkey" FOREIGN KEY ("consumptionEventId") REFERENCES "consumption_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_consumptions" ADD CONSTRAINT "batch_consumptions_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_documents" ADD CONSTRAINT "box_documents_boxMovementId_fkey" FOREIGN KEY ("boxMovementId") REFERENCES "box_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_documents" ADD CONSTRAINT "box_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_movements" ADD CONSTRAINT "box_movements_boxTypeId_fkey" FOREIGN KEY ("boxTypeId") REFERENCES "box_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_movements" ADD CONSTRAINT "box_movements_reversesMovementId_fkey" FOREIGN KEY ("reversesMovementId") REFERENCES "box_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_movements" ADD CONSTRAINT "box_movements_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "box_types" ADD CONSTRAINT "box_types_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_activities" ADD CONSTRAINT "brand_activities_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_contacts" ADD CONSTRAINT "brand_contacts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_record_documents" ADD CONSTRAINT "business_record_documents_businessRecordId_fkey" FOREIGN KEY ("businessRecordId") REFERENCES "business_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_record_documents" ADD CONSTRAINT "business_record_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_events" ADD CONSTRAINT "consumption_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_events" ADD CONSTRAINT "consumption_events_reversesEventId_fkey" FOREIGN KEY ("reversesEventId") REFERENCES "consumption_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_events" ADD CONSTRAINT "consumption_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_eligibility" ADD CONSTRAINT "product_eligibility_potentialSupplierId_fkey" FOREIGN KEY ("potentialSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_eligibility" ADD CONSTRAINT "product_eligibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_researchEntryId_fkey" FOREIGN KEY ("researchEntryId") REFERENCES "research_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_entries" ADD CONSTRAINT "research_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_entries" ADD CONSTRAINT "research_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_boxes" ADD CONSTRAINT "shipment_boxes_boxTypeId_fkey" FOREIGN KEY ("boxTypeId") REFERENCES "box_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_boxes" ADD CONSTRAINT "shipment_boxes_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "marketplaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

