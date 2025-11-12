describe("Bids API - reservation and insertion", () => {
  it("does not insert a bid when reservation fails", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const { Bids } = await import("@/lib/models/bids");

    // Create a house with small budget
    const houseData = {
      name: "LowBudget House",
      totalBudget: 10,
      remainingBudget: 10,
    };
    const res = await Houses.create(
      houseData as unknown as import("@/lib/models/houses").House
    );
    const id = res.insertedId.toString();

    // Try to reserve more than available
    const reserved = await Houses.reserveBudget(id, 100);
    expect(reserved).toBeNull();

    // Ensure no bid exists
    const bids = await Bids.getByHouse(id);
    expect(bids.length).toBe(0);
  });
});
