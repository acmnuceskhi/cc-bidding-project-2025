/**
 * Budget Management Tests
 * Consolidates: admin_budget_adjustment.test.ts + admin_budget_active_round.test.ts
 */

import { generateToken } from "@/lib/auth";

describe("Budget Management & Admin Adjustments", () => {
  async function createAdmin() {
    const { Users } = await import("@/lib/models/users");
    const unique = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({ username: unique, password: "hashed", role: "admin" });
    return generateToken({ userId: res.insertedId.toString(), username: unique, role: "admin" });
  }

  async function createHouseAndCaptain() {
    const { Houses } = await import("@/lib/models/houses");
    const { Users } = await import("@/lib/models/users");
    const { ObjectId } = await import("mongodb");
    
    const house = await Houses.create({ name: `H-${Date.now()}`, totalBudget: 1000, remainingBudget: 1000 });
    const houseId = house.insertedId.toString();
    const user = await Users.create({ username: `cap-${Date.now()}`, password: "hash", role: "house_captain", houseId: new ObjectId(houseId) });
    const token = generateToken({ userId: user.insertedId.toString(), username: "cap", role: "house_captain", houseId });
    
    return { houseId, token };
  }

  async function adjustBudget(admin: string, houseId: string, delta: number) {
    const { PATCH } = await import("@/app/api/houses/[id]/budget/route");
    const req = new Request(`http://localhost/api/houses/${houseId}/budget`, {
      method: "PATCH",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${admin}` }),
      body: JSON.stringify({ adjustRemainingBy: delta }),
    });
    return PATCH(req as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: houseId }) });
  }

  it("admin can increase budget", async () => {
    const admin = await createAdmin();
    const { houseId } = await createHouseAndCaptain();

    const res = await adjustBudget(admin, houseId, 500);
    expect(res.status).toBe(200);

    const { Houses } = await import("@/lib/models/houses");
    const house = await Houses.getById(houseId);
    // adjustRemainingBy only changes remainingBudget, not totalBudget
    expect(house?.totalBudget).toBe(1000);
    expect(house?.remainingBudget).toBe(1500);
  });

  it("admin can decrease budget", async () => {
    const admin = await createAdmin();
    const { houseId } = await createHouseAndCaptain();

    const res = await adjustBudget(admin, houseId, -300);
    expect(res.status).toBe(200);

    const { Houses } = await import("@/lib/models/houses");
    const house = await Houses.getById(houseId);
    // adjustRemainingBy only changes remainingBudget, not totalBudget
    expect(house?.totalBudget).toBe(1000);
    expect(house?.remainingBudget).toBe(700);
  });

  it("rejects adjustment below zero", async () => {
    const admin = await createAdmin();
    const { houseId } = await createHouseAndCaptain();

    const res = await adjustBudget(admin, houseId, -2000);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("INSUFFICIENT_BUDGET");
  });

  it("captain cannot adjust budget (403)", async () => {
    const { houseId, token } = await createHouseAndCaptain();

    const { PATCH } = await import("@/app/api/houses/[id]/budget/route");
    const req = new Request(`http://localhost/api/houses/${houseId}/budget`, {
      method: "PATCH",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
      body: JSON.stringify({ adjustRemainingBy: 100 }),
    });
    const res = await PATCH(req as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: houseId }) });
    expect(res.status).toBe(403);
  });

  it("budget adjustment during active round works correctly", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();

    // Create round and place bid
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    
    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({ name: "Test", rollNumber: `25K-${Date.now()}`, teamId: new ObjectId(team.insertedId.toString()) });
    const r = await Rounds.create({ participantId: new ObjectId(p.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false });

    const { POST } = await import("@/app/api/bids/route");
    const bidReq = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
      body: JSON.stringify({ roundId: r.insertedId.toString(), amount: 400, previousAmount: null }),
    });
    await POST(bidReq as unknown as import("next/server").NextRequest);

    // Verify budget NOT deducted (escrow system - only winners pay on round end)
    const { Houses } = await import("@/lib/models/houses");
    let house = await Houses.getById(houseId);
    expect(house?.remainingBudget).toBe(1000);

    // Adjust budget +500
    await adjustBudget(admin, houseId, 500);

    // Verify adjustment applied
    house = await Houses.getById(houseId);
    expect(house?.totalBudget).toBe(1000); // totalBudget unchanged
    expect(house?.remainingBudget).toBe(1500); // remainingBudget increased by 500
  });

  it("budget returns to original after restart", async () => {
    const admin = await createAdmin();
    const { houseId, token } = await createHouseAndCaptain();

    // Adjust budget
    await adjustBudget(admin, houseId, 200);

    // Create round, bid, end
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    
    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({ name: "Test", rollNumber: `25K-${Date.now()}`, teamId: new ObjectId(team.insertedId.toString()) });
    const r = await Rounds.create({ participantId: new ObjectId(p.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false });

    const { POST: BidPOST } = await import("@/app/api/bids/route");
    const bidReq = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
      body: JSON.stringify({ roundId: r.insertedId.toString(), amount: 300, previousAmount: null }),
    });
    await BidPOST(bidReq as unknown as import("next/server").NextRequest);

    const { POST: EndPOST } = await import("@/app/api/rounds/[id]/end/route");
    const endReq = new Request(`http://localhost/api/rounds/${r.insertedId.toString()}/end`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    await EndPOST(endReq as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: r.insertedId.toString() }) });

    // Restart
    const { POST: RestartPOST } = await import("@/app/api/rounds/[id]/restart/route");
    const restartReq = new Request(`http://localhost/api/rounds/${r.insertedId.toString()}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    await RestartPOST(restartReq as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: r.insertedId.toString() }) });

    // Verify budget restored to adjusted amount
    const { Houses } = await import("@/lib/models/houses");
    const house = await Houses.getById(houseId);
    expect(house?.remainingBudget).toBe(1200); // Original 1000 + adjustment 200
  });
});
