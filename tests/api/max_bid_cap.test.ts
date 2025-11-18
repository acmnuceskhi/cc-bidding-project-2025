import { generateToken } from "@/lib/auth";

describe("Max Bid Cap - API", () => {
  it("rejects amounts exceeding computed safe maximum (no configured cap)", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { Teams } = await import("@/lib/models/teams");
    const { Config } = await import("@/lib/models/config");
    const { ObjectId } = await import("mongodb");

    // Create a house and captain
    const house = await Houses.create({
      name: `H-${Date.now()}`,
      totalBudget: 5000,
      remainingBudget: 5000,
    });
    const houseId = house.insertedId.toString();

    const user = await Users.create({
      username: `cap-${Date.now()}`,
      password: "hash",
      role: "house_captain",
      houseId: new ObjectId(houseId),
    });

    const token = generateToken({
      userId: user.insertedId.toString(),
      username: "cap",
      role: "house_captain",
      houseId,
    });

    // Create a team and set it active in Config
    const team = await Teams.create({ rank: 1, batch: "2025" });
    const teamId = team.insertedId.toString();

    const now = Date.now();
    // Configure a min bid and current round; there is no configured hard cap
    await Config.update({
      minBidAmount: 10,
      maxTeamsPerBatch: 3,
      currentRound: teamId,
      currentRoundStartTime: new Date(now - 5_000),
      currentRoundEndTime: new Date(now + 60_000),
    });

    // Helper to call POST /api/bids
    const { POST } = await import("@/app/api/bids/route");
    async function placeBid(amount: number) {
      const req = new Request("http://localhost/api/bids", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        }),
        body: JSON.stringify({ teamId, amount, previousAmount: null }),
      });
      const res = await POST(
        req as unknown as import("next/server").NextRequest
      );
      return res.json();
    }

    // With house budget set low, computed max should be enforced
    // Place a bid well above safe maximum — expect rejection
    const tooHigh = await placeBid(150);
    expect(tooHigh.success).toBe(false);
    expect(tooHigh.error).toBe("COMPUTED_MAX_EXCEEDED");

    // Place a bid within safe computed max — expect success
    const within = await placeBid(50);
    expect(within.success).toBe(true);
  });
});
