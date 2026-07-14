-- CreateEnum
CREATE TYPE "DirectDealKind" AS ENUM ('PRINCIPAL', 'BROKERAGE');

-- AlterTable
ALTER TABLE "direct_deals"
  ADD COLUMN "kind" "DirectDealKind" NOT NULL DEFAULT 'PRINCIPAL',
  ADD COLUMN "buyerPartyId" TEXT,
  ADD COLUMN "sellerPartyId" TEXT,
  ADD COLUMN "buyerBrokerageRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "buyerBrokerageTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "sellerBrokerageRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "sellerBrokerageTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ALTER COLUMN "side" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "direct_deals_companyId_kind_idx" ON "direct_deals"("companyId", "kind");

-- CreateIndex
CREATE INDEX "direct_deals_companyId_buyerPartyId_idx" ON "direct_deals"("companyId", "buyerPartyId");

-- CreateIndex
CREATE INDEX "direct_deals_companyId_sellerPartyId_idx" ON "direct_deals"("companyId", "sellerPartyId");

-- AddForeignKey
ALTER TABLE "direct_deals" ADD CONSTRAINT "direct_deals_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_deals" ADD CONSTRAINT "direct_deals_sellerPartyId_fkey" FOREIGN KEY ("sellerPartyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
