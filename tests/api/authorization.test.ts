/**
 * Authorization & Role-Based Access Control Tests
 * Consolidates: auth_roles.test.ts + scattered auth checks
 */

import { generateToken } from "@/lib/auth";

describe("Authorization & Role-Based Access", () => {
  async function createAdmin() {
    const { Users } = await import("@/lib/models/users");
    const unique = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({ username: unique, password: "hashed", role: "admin" });
    return generateToken({ userId: res.insertedId.toString(), username: unique, role: "admin" });
  }

  async function createCaptain(houseId: string) {
    const { Users } = await import("@/lib/models/users");
    const { ObjectId } = await import("mongodb");
    const unique = `captain-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await Users.create({ username: unique, password: "hashed", role: "house_captain", houseId: new ObjectId(houseId) });
    return generateToken({ userId: res.insertedId.toString(), username: unique, role: "house_captain", houseId });
  }

  async function createHouse() {
    const { Houses } = await import("@/lib/models/houses");
    const res = await Houses.create({ name: `House-${Date.now()}`, totalBudget: 500, remainingBudget: 500 });
    return res.insertedId.toString();
  }

  async function createParticipantAndRound() {
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({ name: "Test", rollNumber: `25${Date.now()}`, teamId: new ObjectId(team.insertedId.toString()) });
    const r = await Rounds.create({ participantId: new ObjectId(p.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false });
    return { participantId: p.insertedId.toString(), roundId: r.insertedId.toString() };
  }

  it("unauthorized request returns 401", async () => {
    const { POST } = await import("@/app/api/bids/route");
    const req = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: JSON.stringify({ roundId: "fake", amount: 100 }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("captain cannot restart round (403)", async () => {
    const house = await createHouse();
    const captain = await createCaptain(house);
    const { roundId } = await createParticipantAndRound();

    const { POST } = await import("@/app/api/rounds/[id]/restart/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${captain}` }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: roundId }) });
    expect(res.status).toBe(403);
  });

  it("captain cannot end round (403)", async () => {
    const house = await createHouse();
    const captain = await createCaptain(house);
    const { roundId } = await createParticipantAndRound();

    const { POST } = await import("@/app/api/rounds/[id]/end/route");
    const req = new Request(`http://localhost/api/rounds/${roundId}/end`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${captain}` }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: roundId }) });
    expect(res.status).toBe(403);
  });

  it("admin cannot place bid (403)", async () => {
    const admin = await createAdmin();
    const { roundId } = await createParticipantAndRound();

    const { POST } = await import("@/app/api/bids/route");
    const req = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${admin}` }),
      body: JSON.stringify({ roundId, amount: 100, previousAmount: null }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe("FORBIDDEN");
  });

  it("admin can restart and end rounds (200)", async () => {
    const admin = await createAdmin();
    const house = await createHouse();
    const captain = await createCaptain(house);
    const { roundId } = await createParticipantAndRound();

    // Place bid and end
    const { POST: BidPOST } = await import("@/app/api/bids/route");
    const bidReq = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${captain}` }),
      body: JSON.stringify({ roundId, amount: 100, previousAmount: null }),
    });
    await BidPOST(bidReq as unknown as import("next/server").NextRequest);

    const { POST: EndPOST } = await import("@/app/api/rounds/[id]/end/route");
    const endReq = new Request(`http://localhost/api/rounds/${roundId}/end`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    const endRes = await EndPOST(endReq as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: roundId }) });
    expect(endRes.status).toBe(200);

    // Restart
    const { POST: RestartPOST } = await import("@/app/api/rounds/[id]/restart/route");
    const restartReq = new Request(`http://localhost/api/rounds/${roundId}/restart`, {
      method: "POST",
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    const restartRes = await RestartPOST(restartReq as unknown as import("next/server").NextRequest, { params: Promise.resolve({ id: roundId }) });
    expect(restartRes.status).toBe(200);
  });

  it("captain cannot view other house bids (403)", async () => {
    const house1 = await createHouse();
    const house2 = await createHouse();
    const captain1 = await createCaptain(house1);

    const { GET } = await import("@/app/api/bids/route");
    const req = new Request(`http://localhost/api/bids?houseId=${house2}`, {
      headers: new Headers({ authorization: `Bearer ${captain1}` }),
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(403);
  });

  it("admin can view all bids (200)", async () => {
    const admin = await createAdmin();

    const { GET } = await import("@/app/api/bids/route");
    const req = new Request("http://localhost/api/bids", {
      headers: new Headers({ authorization: `Bearer ${admin}` }),
    });
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });
});
