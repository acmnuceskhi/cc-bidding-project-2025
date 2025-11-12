describe("Houses model - reserve & restore", () => {
  it("reserves and restores budget atomically", async () => {
    const { Houses } = await import("@/lib/models/houses");

    // Create a house
    const houseData = {
      name: "Test House",
      totalBudget: 500,
      remainingBudget: 500,
    };
    // create expects a House type; cast to the expected House interface for the call
    const res = await Houses.create(
      houseData as unknown as import("@/lib/models/houses").House
    );

    const id = res.insertedId.toString();
    const before = await Houses.getById(id as string);
    expect(before).not.toBeNull();
    expect(before!.remainingBudget).toBe(500);

    // Reserve 200
    const updated = await Houses.reserveBudget(id, 200);
    expect(updated).not.toBeNull();
    expect(updated!.remainingBudget).toBe(300);

    // Reserving more than available should fail
    const failReserve = await Houses.reserveBudget(id, 1000);
    expect(failReserve).toBeNull();

    // Restore 200
    const restoreRes = await Houses.restoreBudget(id, 200);
    expect(restoreRes.modifiedCount).toBe(1);

    const after = await Houses.getById(id);
    expect(after!.remainingBudget).toBe(500);
  });
});
