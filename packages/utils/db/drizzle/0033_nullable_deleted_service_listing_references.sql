ALTER TABLE "creator_payment_transactions"
  ALTER COLUMN "service_listing_id" DROP NOT NULL;

ALTER TABLE "creator_payment_transactions"
  DROP CONSTRAINT IF EXISTS "creator_payment_transactions_service_listing_id_service_listings_id_fk";

ALTER TABLE "creator_payment_transactions"
  ADD CONSTRAINT "creator_payment_transactions_service_listing_id_service_listings_id_fk"
  FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE SET NULL;
