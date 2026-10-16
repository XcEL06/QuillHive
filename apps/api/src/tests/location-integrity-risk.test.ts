import { describe, expect, it } from "vitest";
import { calculateLoginIntegrityRisk } from "../features/security/locationIntegrity";

describe("login integrity risk signals", () => {
  it("flags a changed device for attention without treating a changed IP alone as fraud", () => {
    expect(calculateLoginIntegrityRisk({
      ipChanged: true,
      countryChanged: false,
      timezoneChanged: false,
      deviceChanged: false,
    })).toEqual({ integrityStatus: "changed", riskScore: 30 });
    expect(calculateLoginIntegrityRisk({
      ipChanged: false,
      countryChanged: false,
      timezoneChanged: false,
      deviceChanged: true,
    })).toEqual({ integrityStatus: "changed", riskScore: 20 });
  });

  it("requires review only when multiple security signals raise combined risk", () => {
    expect(calculateLoginIntegrityRisk({
      ipChanged: true,
      countryChanged: true,
      timezoneChanged: false,
      deviceChanged: false,
    })).toEqual({ integrityStatus: "review", riskScore: 75 });
  });
});
