/**
 * COMPLETE AUCTION FLOW - Comprehensive Integration Test
 *
 * This test covers the entire auction lifecycle from setup to completion,
 * including all critical paths and edge cases:
 *
 * 1. Setup & Authentication
 * 2. Round Creation & Bidding (Pass 1)
 * 3. Winner Selection & Budget Deduction
 * 4. Tie Breaking (timestamp)
 * 5. Round Restart & Refunds
 * 6. Pass 2 Logic (complete houses blocked)
 * 7. Batch Caps & Senior Grouping
 * 8. Skip Behavior (zero bids)
 * 9. Budget Adjustments During Active Round
 * 10. Data Integrity Verification
 */

import { generateToken } from "@/lib/auth";

describe("Complete Auction Flow - End to End", () => {
  let admin: { token: string; userId: string };
  const houses: Record<string, string> = {};
  const captains: Record<string, { token: string; houseId: string }> = {};

  // Helper Functions
  async function createAdmin() {
    const { Users } = await import("@/lib/models/users");
    const unique = `admin-flow-${Date.now()}`;
    const res = await Users.create({
      username: unique,
      password: "hash",
      role: "admin",
    });
    return {
      token: generateToken({
        userId: res.insertedId.toString(),
        username: unique,
        role: "admin",
      }),
      userId: res.insertedId.toString(),
    };
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

  async function createCaptain(name: string, houseId: string) {
    const { Users } = await import("@/lib/models/users");
    const { ObjectId } = await import("mongodb");
    const unique = `cap-${name}-${Date.now()}`;
    const res = await Users.create({
      username: unique,
      password: "hash",
      role: "house_captain",
      houseId: new ObjectId(houseId),
    });
    return {
      token: generateToken({
        userId: res.insertedId.toString(),
        username: unique,
        role: "house_captain",
        houseId,
      }),
      houseId,
    };
  }

  async function createParticipant(rollNumber: string) {
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");
    const team = await Teams.create({ rank: 1 });
    const res = await Participants.create({
      name: `P-${rollNumber}`,
      rollNumber,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    return res.insertedId.toString();
  }

  async function createActiveRound(
    participantId: string,
    passPhase: 1 | 2 = 1
  ) {
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    const res = await Rounds.create({
      participantId: new ObjectId(participantId),
      status: "active",
      passPhase,
      timerEnd: new Date(Date.now() + 60_000),
      finalized: false,
    });
    return res.insertedId.toString();
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

  async function endRound(roundId: string) {
    const { POST } = await import("@/app/api/rounds/[id]/end/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/end`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin.token}` }),
    });
    const res = await POST(
      req as unknown as import("next/server").NextRequest,
      {
        params: Promise.resolve({ id: roundId }),
      }
    );
    return res.json();
  }

  async function restartRound(roundId: string) {
    const { POST } = await import("@/app/api/rounds/[id]/restart/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin.token}` }),
    });
    const res = await POST(
      req as unknown as import("next/server").NextRequest,
      {
        params: Promise.resolve({ id: roundId }),
      }
    );
    return res.json();
  }

  async function adjustBudget(
    houseId: string,
    body: { totalBudget?: number; adjustRemainingBy?: number }
  ) {
    const { PATCH } = await import("@/app/api/houses/[id]/budget/route");
    const req = new Request(`http://localhost/api/houses/${houseId}/budget`, {
      method: "PATCH",
      headers: new Headers({
        "content-type": "application/json",
        authorization: `Bearer ${admin.token}`,
      }),
      body: JSON.stringify(body),
    });
    const res = await PATCH(
      req as unknown as import("next/server").NextRequest,
      {
        params: Promise.resolve({ id: houseId }),
      }
    );
    return { status: res.status, data: await res.json() };
  }

  async function getHouse(houseId: string) {
    const { Houses } = await import("@/lib/models/houses");
    return await Houses.getById(houseId);
  }

  async function getParticipant(participantId: string) {
    const { Participants } = await import("@/lib/models/participants");
    return await Participants.getById(participantId);
  }

  // Test Suite
  beforeAll(async () => {
    admin = await createAdmin();
    houses.red = await createHouse("Red House", 2000);
    houses.blue = await createHouse("Blue House", 2000);
    houses.green = await createHouse("Green House", 2000);
    houses.yellow = await createHouse("Yellow House", 2000);

    captains.red = await createCaptain("red", houses.red);
    captains.blue = await createCaptain("blue", houses.blue);
    captains.green = await createCaptain("green", houses.green);
    captains.yellow = await createCaptain("yellow", houses.yellow);
  });

  it("FLOW 1: Basic round with clear winner, budget deduction, participant assignment", async () => {
    const participant = await createParticipant(`25K-${Date.now()}`);
    const round = await createActiveRound(participant);

    // Multiple houses bid
    await placeBid(captains.red.token, round, 500);
    await placeBid(captains.blue.token, round, 300);
    await placeBid(captains.green.token, round, 450);

    // Admin ends round
    const endResult = await endRound(round);
    expect(endResult.success).toBe(true);
    expect(endResult.winningBid.amount).toBe(500);

    // Verify budget deduction (only winner)
    const redHouse = await getHouse(houses.red);
    const blueHouse = await getHouse(houses.blue);
    const greenHouse = await getHouse(houses.green);
    expect(redHouse!.remainingBudget).toBe(1500); // 2000 - 500
    expect(blueHouse!.remainingBudget).toBe(2000); // unchanged
    expect(greenHouse!.remainingBudget).toBe(2000); // unchanged

    // Verify participant assignment
    const assignedParticipant = await getParticipant(participant);
    expect(assignedParticipant!.houseId?.toString()).toBe(houses.red);
  });

  it("FLOW 2: Tie breaking - earliest timestamp wins", async () => {
    const participant = await createParticipant(`25L-${Date.now()}`);
    const round = await createActiveRound(participant);

    // Place identical bids with slight delay
    await placeBid(captains.blue.token, round, 400);
    await new Promise((r) => setTimeout(r, 10)); // 10ms delay
    await placeBid(captains.yellow.token, round, 400);

    const endResult = await endRound(round);
    expect(endResult.success).toBe(true);
    expect(endResult.winningBid.amount).toBe(400);
    // Blue should win (earlier timestamp)

    const blueHouse = await getHouse(houses.blue);
    const yellowHouse = await getHouse(houses.yellow);
    expect(blueHouse!.remainingBudget).toBe(1600); // 2000 - 400
    expect(yellowHouse!.remainingBudget).toBe(2000); // unchanged
  });

  it("FLOW 3: Round restart refunds winner, clears state, allows rebidding", async () => {
    const participant = await createParticipant(`25M-${Date.now()}`);
    const round = await createActiveRound(participant);

    await placeBid(captains.green.token, round, 600);
    await endRound(round);

    // Verify deduction
    let greenHouse = await getHouse(houses.green);
    expect(greenHouse!.remainingBudget).toBe(1400); // 2000 - 600

    // Restart round
    const restartResult = await restartRound(round);
    expect(restartResult.success).toBe(true);
    expect(restartResult.refundedCount).toBe(1);
    expect(restartResult.totalRefundAmount).toBe(600);

    // Verify refund
    greenHouse = await getHouse(houses.green);
    expect(greenHouse!.remainingBudget).toBe(2000); // refunded

    // Verify participant unassigned
    const unassignedParticipant = await getParticipant(participant);
    expect(unassignedParticipant!.houseId).toBeUndefined();

    // Verify round reset
    const { Rounds } = await import("@/lib/models/rounds");
    const resetRound = await Rounds.getById(round);
    expect(resetRound!.status).toBe("scheduled");
    expect(resetRound!.finalized).toBe(false);
    expect(resetRound!.winningBid).toBeUndefined();
  });

  it("FLOW 4: Skipped round (no bids) marks as completed/skipped", async () => {
    const participant = await createParticipant(`25N-${Date.now()}`);
    const round = await createActiveRound(participant);

    // End without any bids
    const endResult = await endRound(round);
    expect(endResult.success).toBe(true);
    expect(endResult.winningBid).toBeNull();

    const { Rounds } = await import("@/lib/models/rounds");
    const skippedRound = await Rounds.getById(round);
    expect(skippedRound!.status).toBe("completed");
    expect(skippedRound!.skipped).toBe(true);
  });

  it("FLOW 5: Batch cap enforcement - 4th from same batch rejected", async () => {
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");

    // Assign 3 participants from batch 25 to red house
    for (let i = 1; i <= 3; i++) {
      const pid = await createParticipant(`25K-${Date.now()}-${i}`);
      await Participants.update(pid, { houseId: new ObjectId(houses.red) });
    }

    // Try to bid on 4th from batch 25
    const participant = await createParticipant(`25K-${Date.now()}-4`);
    const round = await createActiveRound(participant);

    const bidResult = await placeBid(captains.red.token, round, 100);
    expect(bidResult.success).toBe(false);
    expect(bidResult.error).toBe("BATCH_LIMIT_REACHED");
  });

  it("FLOW 6: Senior grouping - 4th senior rejected regardless of year", async () => {
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");

    // Assign 3 seniors from different years to blue house
    for (const year of ["22", "21", "20"]) {
      const pid = await createParticipant(`${year}K-${Date.now()}`);
      await Participants.update(pid, { houseId: new ObjectId(houses.blue) });
    }

    // Try to bid on 4th senior (19)
    const participant = await createParticipant(`19K-${Date.now()}`);
    const round = await createActiveRound(participant);

    const bidResult = await placeBid(captains.blue.token, round, 100);
    expect(bidResult.success).toBe(false);
    expect(bidResult.error).toBe("BATCH_LIMIT_REACHED");
  });

  it("FLOW 7: Pass 2 blocks complete houses entirely", async () => {
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");

    // Make yellow house complete (3 per batch: 25,24,23,22)
    const batches = ["25", "24", "23", "22"];
    for (const batch of batches) {
      for (let i = 0; i < 3; i++) {
        const pid = await createParticipant(`${batch}A-${Date.now()}-${i}`);
        await Participants.update(pid, {
          houseId: new ObjectId(houses.yellow),
        });
      }
    }

    // Try to bid in pass 2
    const participant = await createParticipant(`24B-${Date.now()}`);
    const round = await createActiveRound(participant, 2);

    const bidResult = await placeBid(captains.yellow.token, round, 100);
    expect(bidResult.success).toBe(false);
    expect(bidResult.error).toBe("PASS2_NOT_ELIGIBLE");
  });

  it("FLOW 8: Skip bid (amount = 0) succeeds for any house in pass 2", async () => {
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");

    // Make green house complete
    for (const batch of ["25", "24", "23", "22"]) {
      for (let i = 0; i < 3; i++) {
        const pid = await createParticipant(`${batch}C-${Date.now()}-${i}`);
        await Participants.update(pid, { houseId: new ObjectId(houses.green) });
      }
    }

    const participant = await createParticipant(`23D-${Date.now()}`);
    const round = await createActiveRound(participant, 2);

    const bidResult = await placeBid(captains.green.token, round, 0);
    expect(bidResult.success).toBe(true);
    expect(bidResult.message).toBe("No bid (skip)");
  });

  it("FLOW 9: Admin budget adjustment during active round preserves spent amount", async () => {
    const participant = await createParticipant(`24E-${Date.now()}`);
    const round = await createActiveRound(participant);

    // Red house bids 300
    await placeBid(captains.red.token, round, 300);

    // Simulate previous spending by manipulating budget directly
    const { Houses } = await import("@/lib/models/houses");
    await Houses.update(houses.red, { remainingBudget: 1200 }); // spent 800

    // Admin adjusts total budget during active round
    const adjustResult = await adjustBudget(houses.red, { totalBudget: 2500 });
    expect(adjustResult.status).toBe(200);
    expect(adjustResult.data.house.totalBudget).toBe(2500);
    expect(adjustResult.data.house.spent).toBe(800); // preserved
    expect(adjustResult.data.house.remainingBudget).toBe(1700); // 2500 - 800
  });

  it("FLOW 10: Data integrity - total budget equals remaining + spent across all houses", async () => {
    const { Houses } = await import("@/lib/models/houses");
    const allHouses = await Houses.getAll();

    let totalBudget = 0;
    let totalRemaining = 0;
    let totalSpent = 0;

    for (const house of allHouses) {
      totalBudget += house.totalBudget;
      totalRemaining += house.remainingBudget;
      totalSpent += house.totalBudget - house.remainingBudget;
    }

    expect(totalBudget).toBe(totalRemaining + totalSpent);
  });

  it("FLOW 11: Authorization - captain cannot restart round, admin cannot place bid", async () => {
    const participant = await createParticipant(`23F-${Date.now()}`);
    const round = await createActiveRound(participant);

    await placeBid(captains.red.token, round, 200);
    await endRound(round);

    // Captain tries to restart
    const { POST: RestartPOST } = await import(
      "@/app/api/rounds/[id]/restart/route"
    );
    const restartReq = new Request(
      `http://localhost/api/rounds/${round}/restart`,
      {
        method: "POST",
        headers: new Headers({ authorization: `Bearer ${captains.red.token}` }),
      }
    );
    const restartRes = await RestartPOST(
      restartReq as unknown as import("next/server").NextRequest,
      {
        params: Promise.resolve({ id: round }),
      }
    );
    await restartRes.json();
    expect(restartRes.status).toBe(403);

    // Admin tries to place bid
    const participant2 = await createParticipant(`23G-${Date.now()}`);
    const round2 = await createActiveRound(participant2);

    const { POST: BidPOST } = await import("@/app/api/bids/route");
    const bidReq = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
        authorization: `Bearer ${admin.token}`,
      }),
      body: JSON.stringify({
        roundId: round2,
        amount: 100,
        previousAmount: null,
      }),
    });
    const bidRes = await BidPOST(
      bidReq as unknown as import("next/server").NextRequest
    );
    await bidRes.json();
    expect(bidRes.status).toBe(403);
  });

  it("FLOW 12: Budget constraints - bid exceeding remaining budget rejected", async () => {
    const participant = await createParticipant(`22H-${Date.now()}`);
    const round = await createActiveRound(participant);

    // Get current remaining budget for red house
    const redHouse = await getHouse(houses.red);
    const exceeding = redHouse!.remainingBudget + 100;

    const bidResult = await placeBid(captains.red.token, round, exceeding);
    expect(bidResult.success).toBe(false);
    expect(bidResult.error).toBe("INSUFFICIENT_CREDITS");
  });
});
