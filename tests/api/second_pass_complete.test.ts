/**
 * Pass 2 Complete Tests
 * Consolidates: second_pass_comprehensive.test.ts + second_pass_gate.test.ts
 */

import { generateToken } from "@/lib/auth";

describe("Pass 2 - Second Chance Bidding", () => {
  async function createHouseAndCaptain() {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { ObjectId } = await import("mongodb");
    
    const house = await Houses.create({ name: `H-${Date.now()}`, totalBudget: 2000, remainingBudget: 2000 });
    const houseId = house.insertedId.toString();
    const user = await Users.create({ username: `cap-${Date.now()}`, password: "hash", role: "house_captain", houseId: new ObjectId(houseId) });
    const token = generateToken({ userId: user.insertedId.toString(), username: "cap", role: "house_captain", houseId });
    
    return { houseId, token };
  }

  async function createAdmin() {
    const { Users } = await import("@/lib/models/users");
    const unique = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({ username: unique, password: "hashed", role: "admin" });
    return generateToken({ userId: res.insertedId.toString(), username: unique, role: "admin" });
  }

  async function createPass2Round() {
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    
    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({ name: "Pass2Test", rollNumber: `25K-${Date.now()}`, teamId: new ObjectId(team.insertedId.toString()) });
    const r = await Rounds.create({ participantId: new ObjectId(p.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false, passPhase: 2 });
    
    return { participantId: p.insertedId.toString(), roundId: r.insertedId.toString() };
  }

  async function placeBid(token: string, roundId: string, amount: number) {
    const { POST } = await import("@/app/api/bids/route");
    const req = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
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
    return POST(req as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: roundId }) });
  }

  it("blocks houses with minimum roster in pass 2", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();

    // Assign 12 participants to meet minimum roster (3 per batch: 25, 24, 23, senior)
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");
    
    const team = await Teams.create({ rank: 1 });
    
    // Add 3 from each batch to meet minimum roster
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P25-${i}`, rollNumber: `25K-${Date.now()}-${i}`, teamId: new ObjectId(team.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P24-${i}`, rollNumber: `24K-${Date.now()}-${i}`, teamId: new ObjectId(team.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P23-${i}`, rollNumber: `23K-${Date.now()}-${i}`, teamId: new ObjectId(team.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P22-${i}`, rollNumber: `22K-${Date.now()}-${i}`, teamId: new ObjectId(team.insertedId.toString()), houseId: new ObjectId(houseId) });
    }

    // Try bidding on pass 2 with full roster
    const { roundId: r2Id } = await createPass2Round();
    const res = await placeBid(token, r2Id, 200);
    const json = await res.json();
    expect(json.error).toBe("PASS2_NOT_ELIGIBLE");
  });

  it("allows houses below minimum roster in pass 2", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();

    // Add only 6 participants (below minimum of 12)
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");
    
    const team1 = await Teams.create({ rank: 1 });
    
    // Add 2 from batch 25 and 2 from batch 24 (not meeting minimum)
    for (let i = 0; i < 2; i++) {
      await Participants.create({ name: `P25-${i}`, rollNumber: `25K-${Date.now()}-${i}`, teamId: new ObjectId(team1.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 2; i++) {
      await Participants.create({ name: `P24-${i}`, rollNumber: `24K-${Date.now()}-${i}`, teamId: new ObjectId(team1.insertedId.toString()), houseId: new ObjectId(houseId) });
    }

    // Can bid on pass 2 with incomplete roster
    const { roundId: r2Id } = await createPass2Round();
    const res = await placeBid(token, r2Id, 150);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("allows skip (zero bid) in pass 2 regardless of roster", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();

    // Fill minimum roster (3 per batch)
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { ObjectId } = await import("mongodb");
    
    const team1 = await Teams.create({ rank: 1 });
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P25-${i}`, rollNumber: `25K-${Date.now()}-${i}`, teamId: new ObjectId(team1.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P24-${i}`, rollNumber: `24K-${Date.now()}-${i}`, teamId: new ObjectId(team1.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P23-${i}`, rollNumber: `23K-${Date.now()}-${i}`, teamId: new ObjectId(team1.insertedId.toString()), houseId: new ObjectId(houseId) });
    }
    for (let i = 0; i < 3; i++) {
      await Participants.create({ name: `P22-${i}`, rollNumber: `22K-${Date.now()}-${i}`, teamId: new ObjectId(team1.insertedId.toString()), houseId: new ObjectId(houseId) });
    }

    // Skip pass 2 (zero bid) - should work even with full roster
    const { roundId: r2Id } = await createPass2Round();
    const res = await placeBid(token, r2Id, 0);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("No bid (skip)");
  });

  it("pass 2 winners count toward batch cap", async () => {
    const { houseId, token } = await createHouseAndCaptain();
    const admin = await createAdmin();

    // Win 3 pass 2 rounds from batch 25
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    
    const team = await Teams.create({ rank: 1 });

    for (let i = 0; i < 3; i++) {
      const p = await Participants.create({ name: `P2-${i}`, rollNumber: `25K-${Date.now()}-${i}`, teamId: new ObjectId(team.insertedId.toString()) });
      const r = await Rounds.create({ participantId: new ObjectId(p.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false, passPhase: 2 });
      await placeBid(token, r.insertedId.toString(), 100 + i * 10);
      await endRound(admin, r.insertedId.toString());
      // Assign winner
      await Participants.update(p.insertedId.toString(), { houseId: new ObjectId(houseId) });
    }

    // Try 4th from same batch
    const p4 = await Participants.create({ name: "P2-4", rollNumber: `25K-${Date.now()}-4`, teamId: new ObjectId(team.insertedId.toString()) });
    const r4 = await Rounds.create({ participantId: new ObjectId(p4.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false, passPhase: 2 });

    const res = await placeBid(token, r4.insertedId.toString(), 150);
    const json = await res.json();
    expect(json.error).toBe("BATCH_LIMIT_REACHED");
  });

  it("pass 2 data persists across restart", async () => {
    const admin = await createAdmin();
    const { token } = await createHouseAndCaptain();
    const { roundId } = await createPass2Round();

    // Place bid and end
    await placeBid(token, roundId, 250);
    await endRound(admin, roundId);

    // Restart
    const { POST } = await import("@/app/api/rounds/[id]/restart/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    await POST(req as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: roundId }) });

    // Verify passPhase still 2
    const { Rounds } = await import("@/lib/models/rounds");
    const round = await Rounds.getById(roundId);
    expect(round?.passPhase).toBe(2);
  });

  it("houses can participate in both passes for different participants", async () => {
    const admin = await createAdmin();
    const { token } = await createHouseAndCaptain();

    // Skip pass 1
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    
    const team1 = await Teams.create({ rank: 1 });
    const p1 = await Participants.create({ name: "Pass1", rollNumber: `25K-${Date.now()}-p1`, teamId: new ObjectId(team1.insertedId.toString()) });
    const r1 = await Rounds.create({ participantId: new ObjectId(p1.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false, passPhase: 1 });

    await placeBid(token, r1.insertedId.toString(), 0); // skip
    await endRound(admin, r1.insertedId.toString());

    // Bid on pass 2
    const { roundId: r2Id } = await createPass2Round();
    const res = await placeBid(token, r2Id, 200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
