describe("Rounds model basic operations", () => {
  it("should create and fetch an active round", async () => {
    const { Rounds } = await import("@/lib/models/rounds");

    await Rounds.create({
      participantId: "000000000000000000000001",
      status: "active",
      timerEnd: new Date(Date.now() + 60000),
    } as any);

    const active = await Rounds.getActive();
    expect(active.length).toBe(1);
    expect(active[0].status).toBe("active");
  });
});
