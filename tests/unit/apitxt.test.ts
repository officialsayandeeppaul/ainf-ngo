import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApitxtError,
  buildSmsParams,
  isValidDob,
  isValidPanFormat,
  normaliseDob,
  dobForApitxt,
  normalisePan,
  panVerify,
} from "@/lib/apitxt";

function mockFetchOnce(body: unknown, init: { status?: number } = {}) {
  const response = new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PAN format", () => {
  it("accepts a well-formed PAN", () => {
    expect(isValidPanFormat("ABCDE1234F")).toBe(true);
    expect(isValidPanFormat("abcde1234f")).toBe(true);
    expect(isValidPanFormat(" ABCDE1234F ")).toBe(true);
  });

  it("rejects malformed PANs", () => {
    expect(isValidPanFormat("ABCD1234F")).toBe(false);
    expect(isValidPanFormat("ABCDE12345")).toBe(false);
    expect(isValidPanFormat("12345ABCDF")).toBe(false);
    expect(isValidPanFormat("ABCDE1234FG")).toBe(false);
    expect(isValidPanFormat("")).toBe(false);
  });

  it("normalises to upper case without spaces", () => {
    expect(normalisePan(" abcde 1234f ")).toBe("ABCDE1234F");
  });
});

describe("date of birth", () => {
  it("accepts dashes, slashes, dots, and digits-only", () => {
    expect(normaliseDob("11-09-2003")).toBe("11-09-2003");
    expect(normaliseDob("11/09/2003")).toBe("11-09-2003");
    expect(normaliseDob("11.09.2003")).toBe("11-09-2003");
    expect(normaliseDob("11092003")).toBe("11-09-2003");
    expect(isValidDob("11/09/2003")).toBe(true);
    expect(isValidDob("11-09-2003")).toBe(true);
    expect(dobForApitxt("11-09-2003")).toBe("11/09/2003");
    expect(dobForApitxt("11092003")).toBe("11/09/2003");
  });

  it("rejects impossible dates", () => {
    expect(isValidDob("32-01-2000")).toBe(false);
    expect(isValidDob("29-02-2023")).toBe(false);
    expect(isValidDob("00-10-2000")).toBe(false);
    expect(isValidDob("not-a-date")).toBe(false);
  });
});

describe("panVerify error mapping", () => {
  it("rejects a malformed PAN before spending a credit", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(
      panVerify({ pan: "BADPAN", name: "Ada Lovelace", dob: "10-12-1815" })
    ).rejects.toMatchObject({ kind: "invalid_pan" });
    // The important part: no network call, so no credit consumed.
    expect(spy).not.toHaveBeenCalled();
  });

  it("maps 301 to a retryable balance failure", async () => {
    mockFetchOnce({ status: "301", message: "Insufficient balance" });
    const error = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ApitxtError);
    expect(error.kind).toBe("insufficient_balance");
    expect(error.retryable).toBe(true);
    // The user must not see "insufficient balance".
    expect(error.message).not.toMatch(/balance/i);
  });

  it("maps 304 to a non-retryable credentials failure", async () => {
    mockFetchOnce({ status: "304" });
    const error = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    }).catch((e) => e);
    expect(error.kind).toBe("invalid_credentials");
    expect(error.retryable).toBe(false);
  });

  it("maps 310 to a retryable vendor failure", async () => {
    mockFetchOnce({ status: "310" });
    const error = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    }).catch((e) => e);
    expect(error.kind).toBe("vendor_failure");
    expect(error.retryable).toBe(true);
  });

  it("treats a network failure as retryable transport", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNRESET"));
    const error = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    }).catch((e) => e);
    expect(error.kind).toBe("transport");
    expect(error.retryable).toBe(true);
  });

  it("treats unparseable output as a vendor failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>gateway timeout</html>", { status: 200 })
    );
    const error = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    }).catch((e) => e);
    expect(error.kind).toBe("vendor_failure");
  });
});

describe("panVerify success handling", () => {
  it("reports a full match", async () => {
    mockFetchOnce({
      status: "200",
      request_id: "req_1",
      data: { name_match: "Y", dob_match: "Y", aadhaar_seeding_status: "Y", category: "Individual" },
    });
    const result = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    });
    expect(result.matched).toBe(true);
    expect(result.nameMatch).toBe(true);
    expect(result.dobMatch).toBe(true);
    expect(result.aadhaarSeedingStatus).toBe("Y");
    expect(result.requestId).toBe("req_1");
  });

  it("reports a mismatch when the name does not match", async () => {
    mockFetchOnce({ status: "200", data: { name_match: "N", dob_match: "Y" } });
    const result = await panVerify({
      pan: "ABCDE1234F",
      name: "Wrong Name",
      dob: "10-12-1815",
    });
    expect(result.matched).toBe(false);
    expect(result.nameMatch).toBe(false);
  });

  it("does not treat an unknown match flag as a mismatch", async () => {
    // Absent flags mean "not asserted", which should not fail the check.
    mockFetchOnce({ status: "200", data: { category: "Individual" } });
    const result = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    });
    expect(result.nameMatch).toBeNull();
    expect(result.dobMatch).toBeNull();
    expect(result.matched).toBe(true);
  });

  it("strips the PAN out of the retained payload", async () => {
    mockFetchOnce({
      status: "200",
      data: {
        pan: "ABCDE1234F",
        pan_number: "ABCDE1234F",
        holder: "ABCDE1234F",
        name_match: "Y",
        category: "Individual",
      },
    });
    const result = await panVerify({
      pan: "ABCDE1234F",
      name: "Ada Lovelace",
      dob: "10-12-1815",
    });
    const serialised = JSON.stringify(result.raw);
    expect(serialised).not.toContain("ABCDE1234F");
    expect(result.raw.category).toBe("Individual");
  });

  it("sends the PAN normalised to upper case", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "200", data: { name_match: "Y" } }), { status: 200 })
    );
    await panVerify({ pan: "abcde1234f", name: "Ada", dob: "10-12-1815" });
    const body = JSON.parse(String(spy.mock.calls[0]?.[1]?.body));
    expect(body.pan).toBe("ABCDE1234F");
    expect(body.dob).toBe("10/12/1815");
  });
});

describe("SMS without DLT", () => {
  it("omits DLT fields when APITXT_REQUIRE_DLT is not true", () => {
    const body = buildSmsParams({ to: "9876543210", message: "AINF: 123456" });
    expect(body).toBeInstanceOf(URLSearchParams);
    const params = body as URLSearchParams;
    expect(params.get("sender")).toBe("AINFTX");
    expect(params.get("mobiles")).toBe("9876543210");
    expect(params.has("DLT_TE_ID")).toBe(false);
    expect(params.has("PE_ID")).toBe(false);
  });
});
