-- AlterTable
ALTER TABLE "products" ADD COLUMN     "expectedSellingPrice" DECIMAL(12,4),
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "paymentTerms" TEXT;
