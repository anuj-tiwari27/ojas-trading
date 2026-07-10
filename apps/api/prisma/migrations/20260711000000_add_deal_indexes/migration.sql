-- CreateIndex
CREATE INDEX "direct_deals_companyId_productId_idx" ON "direct_deals"("companyId", "productId");

-- CreateIndex
CREATE INDEX "direct_deals_companyId_selfPartyId_idx" ON "direct_deals"("companyId", "selfPartyId");

-- CreateIndex
CREATE INDEX "direct_deals_companyId_paymentStatus_idx" ON "direct_deals"("companyId", "paymentStatus");

-- CreateIndex
CREATE INDEX "degum_deals_companyId_productId_idx" ON "degum_deals"("companyId", "productId");

-- CreateIndex
CREATE INDEX "degum_deals_companyId_selfPartyId_idx" ON "degum_deals"("companyId", "selfPartyId");

-- CreateIndex
CREATE INDEX "degum_deals_companyId_dealDate_idx" ON "degum_deals"("companyId", "dealDate");
