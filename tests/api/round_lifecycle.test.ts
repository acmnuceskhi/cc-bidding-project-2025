/**
 * Round Lifecycle Tests
 * Consolidates: round_flows.test.ts + round_flow_resilience.test.ts +
 *               restart_comprehensive.test.ts + restart_idempotence.test.ts
 */

import { generateToken } from "@/lib/auth";

describe("Round Lifecycle Management", () => {
  async function createAdmin() {
    const { Users } = await import("@/lib/models/users");
    const unique = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({
      username: unique,
      password: "hashed",
      role: "admin",
    });
    return generateToken({
      userId: res.insertedId.toString(),
      username: unique,
      role: "admin",
    });
  }

  async function createHouseAndCaptain() {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { ObjectId } = await import("mongodb");

    const house = await Houses.create({
      name: `H-${Date.now()}`,
      totalBudget: 1000,
      remainingBudget: 1000,
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

    return { houseId, token };
  }

  async function createParticipantAndRound() {
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");

    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({
      name: "Test",
      rollNumber: `25K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const r = await Rounds.create({
      participantId: new ObjectId(p.insertedId.toString()),
      status: "active",
      timerEnd: new Date(Date.now() + 10000),
      finalized: false,
    });

    return {
      participantId: p.insertedId.toString(),
      roundId: r.insertedId.toString(),
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
    return POST(req as unknown as import("next/server").NextRequest);
  }

  async function endRound(admin: string, roundId: string) {
    const { POST } = await import("@/app/api/rounds/[id]/end/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/end`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    return POST(req as unknown as import("next/server").NextRequest, {
      params: Promise.resolve({ id: roundId }),
    });
  }

  async function restartRound(admin: string, roundId: string) {
    const { POST } = await import("@/app/api/rounds/[id]/restart/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    return POST(req as unknown as import("next/server").NextRequest, {
      params: Promise.resolve({ id: roundId }),
    });
  }

  it("complete lifecycle: scheduled → active → completed", async () => {
    const { Rounds } = await import("@/lib/models/rounds");
    const { Participants } = await import("@/lib/models/participants");
    const { Teams } = await import("@/lib/models/teams");
    const { ObjectId } = await import("mongodb");

    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({
      name: "Lifecycle",
      rollNumber: `25K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });

    // Scheduled
    const r = await Rounds.create({
      participantId: new ObjectId(p.insertedId.toString()),
      status: "scheduled",
      timerEnd: null,
      finalized: false,
    });
    let round = await Rounds.getById(r.insertedId.toString());
    expect(round?.status).toBe("scheduled");

    // Active
    await Rounds.update(r.insertedId.toString(), {
      status: "active",
      timerEnd: new Date(Date.now() + 5000),
    });
    round = await Rounds.getById(r.insertedId.toString());
    expect(round?.status).toBe("active");

    // Completed
    await Rounds.update(r.insertedId.toString(), {
      status: "completed",
      finalized: true,
    });
    round = await Rounds.getById(r.insertedId.toString());
    expect(round?.status).toBe("completed");
    expect(round?.finalized).toBe(true);
  });

  it("restart refunds all bids and resets status", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();
    const { roundId } = await createParticipantAndRound();

    // Place bid and end
    await placeBid(token, roundId, 200);
    await endRound(admin, roundId);

    // Verify budget deducted
    const { Houses } = await import("@/lib/models/houses");
    let house = await Houses.getById(houseId);
    expect(house?.remainingBudget).toBe(800);

    // Restart
    const res = await restartRound(admin, roundId);
    expect(res.status).toBe(200);

    // Verify refund
    house = await Houses.getById(houseId);
    expect(house?.remainingBudget).toBe(1000);

    // Verify round reset
    const { Rounds } = await import("@/lib/models/rounds");
    const round = await Rounds.getById(roundId);
    expect(round?.status).toBe("scheduled");
    expect(round?.finalized).toBe(false);
  });

  it("idempotent restart (multiple calls safe)", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();
    const { roundId } = await createParticipantAndRound();

    await placeBid(token, roundId, 150);
    await endRound(admin, roundId);

    // Restart twice
    await restartRound(admin, roundId);
    await restartRound(admin, roundId);

    // Budget should still be 1000 (not over-refunded)
    const { Houses } = await import("@/lib/models/houses");
    const house = await Houses.getById(houseId);
    expect(house?.remainingBudget).toBe(1000);
  });

  it("cannot restart non-finalized round", async () => {
    const admin = await createAdmin();
    const { roundId } = await createParticipantAndRound();

    const res = await restartRound(admin, roundId);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.canRestart).toBe(false);
    expect(json.message).toBe("Round is not completed; no restart needed");
  });

  it("ending round finalizes and computes winner", async () => {
    const admin = await createAdmin();
    const { token } = await createHouseAndCaptain();
    const { roundId } = await createParticipantAndRound();

    await placeBid(token, roundId, 250);
    const res = await endRound(admin, roundId);
    expect(res.status).toBe(200);

    const { Rounds } = await import("@/lib/models/rounds");
    const round = await Rounds.getById(roundId);
    expect(round?.finalized).toBe(true);
    expect(round?.status).toBe("completed");
  });

  it("skipped round has no winner", async () => {
    const admin = await createAdmin();
    const { token } = await createHouseAndCaptain();
    const { roundId } = await createParticipantAndRound();

    // Place zero bid (skip)
    await placeBid(token, roundId, 0);
    await endRound(admin, roundId);

    const { Rounds } = await import("@/lib/models/rounds");
    const round = await Rounds.getById(roundId);
    expect(round?.finalized).toBe(false);
    expect(round?.skipped).toBe(true);
    expect(round?.status).toBe("completed");
  });

  it("handles concurrent bids during active round", async () => {
    const { token: t1 } = await createHouseAndCaptain();
    const { token: t2 } = await createHouseAndCaptain();
    const { roundId } = await createParticipantAndRound();

    // Concurrent bids
    const results = await Promise.all([
      placeBid(t1, roundId, 100),
      placeBid(t2, roundId, 150),
    ]);

    // Both bids should succeed
    const [r1, r2] = await Promise.all(results.map((r) => r.json()));
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("expired timer prevents new bids", async () => {
    const { Rounds } = await import("@/lib/models/rounds");
    const { Participants } = await import("@/lib/models/participants");
    const { Teams } = await import("@/lib/models/teams");
    const { ObjectId } = await import("mongodb");

    const { token } = await createHouseAndCaptain();
    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({
      name: "Expired",
      rollNumber: `25K-${Date.now()}`,
      teamId: new ObjectId(team.insertedId.toString()),
    });
    const r = await Rounds.create({
      participantId: new ObjectId(p.insertedId.toString()),
      status: "active",
      timerEnd: new Date(Date.now() - 1000),
      finalized: false,
    });

    const res = await placeBid(token, r.insertedId.toString(), 100);
    const json = await res.json();
    expect(json.error).toBe("ROUND_EXPIRED");
  });
});
