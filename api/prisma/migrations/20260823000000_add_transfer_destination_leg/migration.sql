-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "to_account_id" TEXT;

-- CreateIndex
CREATE INDEX "transactions_to_account_id_idx" ON "transactions"("to_account_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
