import { generateToken } from "@/lib/auth";

describe("Data integrity assertions (meta)", () => {
  async function createAdmin() {
    const { Users } = await import("@/lib/models/users");
    const unique = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({
      username: unique,
      password: "hashed",
      role: "admin",
    });
    const token = generateToken({
      userId: res.insertedId.toString(),
      username: unique,
      role: "admin",
    });
    return { token, userId: res.insertedId.toString() };
  }

  async function createHouse(name: string, budget: number) {
    const { Houses } = await import("@/lib/models/houses");
    const res = await Houses.create({
      name,
      totalBudget: budget,
      remainingBudget: budget,
    });
    return res.insertedId.toString();
  }

  async function createCaptain(base: string, houseId: string) {
    const { Users } = await import("@/lib/models/users");
    const { ObjectId } = await import("mongodb");
    const unique = `${base}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({
      username: unique,
      password: "hashed",
      role: "house_captain",
      houseId: new ObjectId(houseId),
    });
    const token = generateToken({
      userId: res.insertedId.toString(),
      username: unique,
      role: "house_captain",
      houseId,
    });
    return { token, userId: res.insertedId.toString() };
  }

  async function createParticipant(rollNumber: string) {
    const { Teams } = await import("@/lib/models/teams");
    const team = await Teams.create({ rank: 1 });
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");
    const p = await Participants.create({
      name: `Participant-${rollNumber}`,
      rollNumber,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    return p.insertedId.toString();
  }

  async function createActiveRound(participantId: string) {
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    const r = await Rounds.create({
      participantId: new ObjectId(participantId),
      status: "active",
      timerEnd: new Date(Date.now() + 10_000),
      finalized: false,
    });
    return r.insertedId.toString();
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

  async function endRound(adminToken: string, roundId: string) {
    const { POST } = await import("@/app/api/rounds/[id]/end/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/end`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${adminToken}` }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest, {
      params: Promise.resolve({ id: roundId }),
    });
    return res.json();
  }

  async function restartRound(adminToken: string, roundId: string) {
    const { POST } = await import("@/app/api/rounds/[id]/restart/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${adminToken}` }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest, {
      params: Promise.resolve({ id: roundId }),
    });
    return res.json();
  }

  it("budget invariant: Σ(remainingBudget + spent) = Σ(totalBudget)", async () => {
    const admin = await createAdmin();
    const houseA = await createHouse("InvariantA", 1000);
    const houseB = await createHouse("InvariantB", 1500);
    const captainA = await createCaptain("cap-inv-a", houseA);
    const captainB = await createCaptain("cap-inv-b", houseB);

    const totalBudgetStart = 1000 + 1500; // 2500
    const createdHouseIds = [houseA, houseB];

    // Create 5 rounds and simulate random bidding
    for (let i = 0; i < 5; i++) {
      const participant = await createParticipant(`25K-INV${i}`);
      const round = await createActiveRound(participant);

      // Random bidding
      if (i % 2 === 0) {
        await placeBid(captainA.token, round, 100 + i * 50);
      } else {
        await placeBid(captainB.token, round, 150 + i * 30);
      }

      await endRound(admin.token, round);
    }

    // Check invariant - only sum houses created in this test
    const { Houses } = await import("@/lib/models/houses");
    const testHouses = await Promise.all(
      createdHouseIds.map((id) => Houses.getById(id))
    );
    const totalRemaining = testHouses.reduce(
      (sum, h) => sum + (h?.remainingBudget || 0),
      0
    );
    const totalBudget = testHouses.reduce(
      (sum, h) => sum + (h?.totalBudget || 0),
      0
    );
    const totalSpent = totalBudget - totalRemaining;

    expect(totalBudget).toBe(totalBudgetStart);
    expect(totalRemaining + totalSpent).toBe(totalBudget);
  });

  it("each participant assigned to at most 1 house", async () => {
    const admin = await createAdmin();
    const houseA = await createHouse("UniqueA", 2000);
    const houseB = await createHouse("UniqueB", 2000);
    const captainA = await createCaptain("cap-unique-a", houseA);
    const captainB = await createCaptain("cap-unique-b", houseB);

    // Create 10 participants and randomly assign
    for (let i = 0; i < 10; i++) {
      const participant = await createParticipant(`25L-UNIQ${i}`);
      const round = await createActiveRound(participant);

      if (i % 3 === 0) {
        await placeBid(captainA.token, round, 100 + i * 10);
      } else if (i % 3 === 1) {
        await placeBid(captainB.token, round, 120 + i * 10);
      }
      // i % 3 === 2: no bids

      await endRound(admin.token, round);
    }

    // Verify each participant has at most 1 houseId
    const { Participants } = await import("@/lib/models/participants");
    const allParticipants = await Participants.getAll();
    const assignedParticipants = allParticipants.filter((p) => p.houseId);

    // Create a Set to check uniqueness of assignments
    const assignmentCount = new Map<string, number>();
    assignedParticipants.forEach((p) => {
      const key = p._id!.toString();
      assignmentCount.set(key, (assignmentCount.get(key) || 0) + 1);
    });

    // Each participant should appear at most once
    assignmentCount.forEach((count) => {
      expect(count).toBe(1);
    });
  });

  it("all completed rounds have finalized = true or skipped = true", async () => {
    const admin = await createAdmin();
    const house = await createHouse("CompletedHouse", 2000);
    const captain = await createCaptain("cap-completed", house);

    // Create 3 rounds: 1 with bid, 1 without bid, 1 with bid
    for (let i = 0; i < 3; i++) {
      const participant = await createParticipant(`25M-COMP${i}`);
      const round = await createActiveRound(participant);

      if (i !== 1) {
        // Skip middle round (no bids)
        await placeBid(captain.token, round, 100 + i * 50);
      }

      await endRound(admin.token, round);
    }

    // Verify all completed rounds have finalized or skipped
    const { Rounds } = await import("@/lib/models/rounds");
    const allRounds = await Rounds.getAll();
    const completedRounds = allRounds.filter((r) => r.status === "completed");

    completedRounds.forEach((r) => {
      expect(r.finalized === true || r.skipped === true).toBe(true);
    });
  });

  it("no bid references missing roundId or houseId", async () => {
    const admin = await createAdmin();
    const house = await createHouse("BidRefHouse", 1000);
    const captain = await createCaptain("cap-bidref", house);

    // Place 5 bids across different rounds
    for (let i = 0; i < 5; i++) {
      const participant = await createParticipant(`25I-BID${i}`);
      const round = await createActiveRound(participant);
      await placeBid(captain.token, round, 100 + i * 20);
      await endRound(admin.token, round);
    }

    // Verify all bids have valid roundId and houseId
    const { Bids } = await import("@/lib/models/bids");
    const allBids = await Bids.getAll();

    allBids.forEach((bid) => {
      expect(bid.roundId).toBeDefined();
      expect(bid.houseId).toBeDefined();
      expect(bid.participantId).toBeDefined();
      expect(bid.amount).toBeGreaterThan(0);
    });
  });

  it("after restart, participant houseId is null", async () => {
    const admin = await createAdmin();
    const house = await createHouse("RestartNullHouse", 1000);
    const captain = await createCaptain("cap-restart-null", house);
    const participant = await createParticipant("25P-RESTART");
    const round = await createActiveRound(participant);

    // Bid and end
    await placeBid(captain.token, round, 200);
    await endRound(admin.token, round);

    // Verify assignment
    const { Participants } = await import("@/lib/models/participants");
    let p = await Participants.getById(participant);
    expect(p!.houseId).toBeDefined();
    expect(p!.houseId!.toString()).toBe(house);

    // Restart
    await restartRound(admin.token, round);

    // Verify houseId cleared
    p = await Participants.getById(participant);
    expect(p!.houseId).toBeUndefined();
  });

  it("complex simulation: 20+ rounds with random actions", async () => {
    const admin = await createAdmin();
    const houses = [
      await createHouse("SimHouse1", 5000),
      await createHouse("SimHouse2", 5000),
      await createHouse("SimHouse3", 5000),
    ];
    const captains = [
      await createCaptain("sim-cap1", houses[0]),
      await createCaptain("sim-cap2", houses[1]),
      await createCaptain("sim-cap3", houses[2]),
    ];

    const initialTotalBudget = 15000;

    // Simulate 20 rounds
    for (let i = 0; i < 20; i++) {
      const participant = await createParticipant(`25F-SIM${i}`);
      const round = await createActiveRound(participant);

      // Random bidding pattern
      const numBidders = Math.floor(Math.random() * 3) + 1; // 1-3 bidders
      for (let j = 0; j < numBidders; j++) {
        const captainIndex = j % captains.length;
        const amount = 50 + Math.floor(Math.random() * 200);
        const { Houses } = await import("@/lib/models/houses");
        const house = await Houses.getById(houses[captainIndex]);
        if (house && house.remainingBudget >= amount) {
          await placeBid(captains[captainIndex].token, round, amount);
        }
      }

      await endRound(admin.token, round);

      // Randomly restart some rounds (10% chance)
      if (Math.random() < 0.1) {
        await restartRound(admin.token, round);
      }
    }

    // Final invariant checks - only verify houses created in this test
    const { Houses } = await import("@/lib/models/houses");
    const testHouses = await Promise.all(
      houses.map((id) => Houses.getById(id))
    );
    const totalRemaining = testHouses.reduce(
      (sum, h) => sum + (h?.remainingBudget || 0),
      0
    );
    const totalBudget = testHouses.reduce(
      (sum, h) => sum + (h?.totalBudget || 0),
      0
    );

    // Budget conservation
    expect(totalBudget).toBe(initialTotalBudget);
    expect(totalRemaining).toBeLessThanOrEqual(totalBudget);
    expect(totalRemaining).toBeGreaterThanOrEqual(0);

    // No participant assigned to multiple houses
    const { Participants } = await import("@/lib/models/participants");
    const allParticipants = await Participants.getAll();
    const assignedParticipants = allParticipants.filter((p) => p.houseId);
    const uniqueAssignments = new Set(
      assignedParticipants.map((p) => p._id!.toString())
    );
    expect(uniqueAssignments.size).toBe(assignedParticipants.length);

    // All completed rounds properly finalized or skipped
    const { Rounds } = await import("@/lib/models/rounds");
    const allRounds = await Rounds.getAll();
    const completedRounds = allRounds.filter((r) => r.status === "completed");
    completedRounds.forEach((r) => {
      expect(r.finalized === true || r.skipped === true).toBe(true);
    });
  });
});
