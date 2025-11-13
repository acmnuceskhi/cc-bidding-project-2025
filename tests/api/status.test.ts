describe("GET /api/status", () => {
  it("returns idle state when no active rounds", async () => {
    const { GET } = await import("@/app/api/status/route");
    const res = await GET();
    const data = await res.json();

    expect(data.roundStatus).toBe("idle");
    expect(data.serverTime).toBeDefined();
    expect(typeof data.serverTime).toBe("number");
  });
});
