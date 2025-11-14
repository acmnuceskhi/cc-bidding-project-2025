/**
 * Bidding System Tests
 * Consolidates: bids_validation.test.ts + batch_cap_grouping.test.ts
 */

import { generateToken } from "@/lib/auth";

describe("Bidding System - Validation & Constraints", () => {
  async function setup() {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");

    const house = await Houses.create({
      name: `H-${Date.now()}`,
      totalBudget: 500,
      remainingBudget: 500,
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

    const team = await Teams.create({ rank: 1 });
    const participant = await Participants.create({
      name: "Test",
      rollNumber: `25K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const round = await Rounds.create({
      participantId: new ObjectId(participant.insertedId.toString()),
      status: "active",
      timerEnd: new Date(Date.now() + 10000),
      finalized: false,
    });

    return {
      token,
      houseId,
      roundId: round.insertedId.toString(),
      participantId: participant.insertedId.toString(),
    };
  }

  async function placeBid(token: string, roundId: string, amount: number) {
    const { POST } = await import("@/app/api/bids/route");
    const req = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      }),
      body: JSON.stringify({ roundId, amount, previousAmount: null }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    return res.json();
  }

  it("rejects bid higher than remainingBudget", async () => {
    const { token, roundId } = await setup();
    const res = await placeBid(token, roundId, 1000);
    expect(res.error).toBe("INSUFFICIENT_CREDITS");
  });

  it("rejects negative bid amount", async () => {
    const { token, roundId } = await setup();
    const res = await placeBid(token, roundId, -50);
    expect(res.error).toBe("INVALID_AMOUNT");
  });

  it("accepts zero bid (skip)", async () => {
    const { token, roundId } = await setup();
    const res = await placeBid(token, roundId, 0);
    expect(res.success).toBe(true);
    expect(res.message).toBe("No bid (skip)");
  });

  it("rejects bid on non-active round", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");

    const house = await Houses.create({
      name: `H-${Date.now()}`,
      totalBudget: 500,
      remainingBudget: 500,
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
    const team = await Teams.create({ rank: 1 });
    const participant = await Participants.create({
      name: "Test",
      rollNumber: `25K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const round = await Rounds.create({
      participantId: new ObjectId(participant.insertedId.toString()),
      status: "scheduled",
      timerEnd: null,
      finalized: false,
    });

    const res = await placeBid(token, round.insertedId.toString(), 100);
    expect(res.error).toBe("ROUND_NOT_ACTIVE");
  });

  it("rejects bid after timer expired", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");

    const house = await Houses.create({
      name: `H-${Date.now()}`,
      totalBudget: 500,
      remainingBudget: 500,
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
    const team = await Teams.create({ rank: 1 });
    const participant = await Participants.create({
      name: "Test",
      rollNumber: `25K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const round = await Rounds.create({
      participantId: new ObjectId(participant.insertedId.toString()),
      status: "active",
      timerEnd: new Date(Date.now() - 1000),
      finalized: false,
    });

    const res = await placeBid(token, round.insertedId.toString(), 100);
    expect(res.error).toBe("ROUND_EXPIRED");
  });

  it("enforces 3-per-batch cap", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { Teams } = await import("@/lib/models/teams");
    const { ObjectId } = await import("mongodb");

    const house = await Houses.create({
      name: `H-${Date.now()}`,
      totalBudget: 2000,
      remainingBudget: 2000,
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

    // Assign 3 from batch 25
    const team = await Teams.create({ rank: 1 });
    for (let i = 0; i < 3; i++) {
      await Participants.create({
        name: `P${i}`,
        rollNumber: `25K-${Date.now()}-${i}`,
        teamId: new ObjectId(team.insertedId.toString()),
        houseId: new ObjectId(houseId),
      });
    }

    // Try 4th
    const p4 = await Participants.create({
      name: "P4",
      rollNumber: `25K-${Date.now()}-4`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const round = await Rounds.create({
      participantId: new ObjectId(p4.insertedId.toString()),
      status: "active",
      timerEnd: new Date(Date.now() + 10000),
      finalized: false,
    });

    const res = await placeBid(token, round.insertedId.toString(), 100);
    expect(res.error).toBe("BATCH_LIMIT_REACHED");
  });

  it("groups seniors across years (max 3 total)", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");

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

    // Assign 3 seniors from different years
    const team = await Teams.create({ rank: 1 });
    for (const year of ["22", "21", "20"]) {
      await Participants.create({
        name: `S${year}`,
        rollNumber: `${year}K-${Date.now()}`,
        teamId: new ObjectId(team.insertedId.toString()),
        houseId: new ObjectId(houseId),
      });
    }

    // Try 4th senior from year 19
    const s4 = await Participants.create({
      name: "S19",
      rollNumber: `19K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const round = await Rounds.create({
      participantId: new ObjectId(s4.insertedId.toString()),
      status: "active",
      timerEnd: new Date(Date.now() + 10000),
      finalized: false,
    });

    const res = await placeBid(token, round.insertedId.toString(), 100);
    expect(res.error).toBe("BATCH_LIMIT_REACHED");
  });

  it("allows bid replacement (upsert)", async () => {
    const { token, roundId } = await setup();

    const res1 = await placeBid(token, roundId, 100);
    expect(res1.success).toBe(true);

    const res2 = await placeBid(token, roundId, 150);
    expect(res2.success).toBe(true);
    expect(res2.message).toBeDefined();
  });
});
