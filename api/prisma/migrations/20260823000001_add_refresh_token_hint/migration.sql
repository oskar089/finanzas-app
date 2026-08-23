-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "token_hint" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hint_idx" ON "refresh_tokens"("token_hint");
