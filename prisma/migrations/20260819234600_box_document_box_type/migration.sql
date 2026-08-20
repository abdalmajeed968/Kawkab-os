-- AlterTable
ALTER TABLE "box_documents" ADD COLUMN     "boxTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "box_documents" ADD CONSTRAINT "box_documents_boxTypeId_fkey" FOREIGN KEY ("boxTypeId") REFERENCES "box_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
