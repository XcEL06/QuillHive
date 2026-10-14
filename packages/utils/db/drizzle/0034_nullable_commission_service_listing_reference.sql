ALTER TABLE "commission_requests"
  DROP CONSTRAINT IF EXISTS "commission_requests_service_listing_id_service_listings_id_fk";

ALTER TABLE "commission_requests"
  ADD CONSTRAINT "commission_requests_service_listing_id_service_listings_id_fk"
  FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE SET NULL;
