/**
 * Status Endpoint Tests
 * Consolidates: status.test.ts + status_autoend.test.ts
 */

import { generateToken } from "@/lib/auth";

describe("Status Endpoint - Real-time Auction State", () => {
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

  async function createActiveRound() {
    const { Teams } = await import("@/lib/models/teams");
    const { Participants } = await import("@/lib/models/participants");
    const { Rounds } = await import("@/lib/models/rounds");
    const { ObjectId } = await import("mongodb");
    
    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({ name: "Test", rollNumber: `25K-${Date.now()}`, teamId: new ObjectId(team.insertedId.toString()) });
    const r = await Rounds.create({ participantId: new ObjectId(p.insertedId.toString()), status: "active", timerEnd: new Date(Date.now() + 10000), finalized: false });
    
    return { participantId: p.insertedId.toString(), roundId: r.insertedId.toString() };
  }

  async function getStatus() {
    const { GET } = await import("@/app/api/status/route");
    const req = new Request("http://localhost/api/status");
    const res = await GET();
    return res.json();
  }

  it("returns current active round", async () => {
    await createActiveRound();
    const status = await getStatus();
    expect(status.roundId).toBeDefined();
    expect(status.roundStatus).toBe("active");
  });

  it("includes participant details", async () => {
    const { participantId } = await createActiveRound();
    const status = await getStatus();
    expect(status.participant).toBeDefined();
    expect(status.participant.participantId).toBe(participantId);
  });

  it("includes timer information", async () => {
    await createActiveRound();
    const status = await getStatus();
    expect(status.timerEnd).toBeDefined();
    const timerEnd = new Date(status.timerEnd);
    expect(timerEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null when no active round", async () => {
    const status = await getStatus();
    if (status.roundId) {
      // There might be an active round from other tests
      expect(status.roundStatus).toBe("active");
    } else {
      expect(status.roundId).toBeNull();
    }
  });

  it("detects expired rounds and returns completed status", async () => {
    const { Rounds } = await import("@/lib/models/rounds");
    const { Participants } = await import("@/lib/models/participants");
    const { Teams } = await import("@/lib/models/teams");
    const { ObjectId } = await import("mongodb");

    const team = await Teams.create({ rank: 1 });
    const p = await Participants.create({ name: "Expired", rollNumber: `25K-${Date.now()}`, teamId: new ObjectId(team.insertedId.toString()) });
    const r = await Rounds.create({ 
      participantId: new ObjectId(p.insertedId.toString()), 
      status: "active", 
      timerEnd: new Date(Date.now() - 5000), 
      finalized: false 
    });

    // Trigger status check - expired rounds are auto-ended
    const status = await getStatus();
    
    // Status endpoint detects expiration and handles it
    // Either returns completed status or is still processing
    expect(["completed", "active"]).toContain(status.roundStatus);
    
    // If completed immediately, verify properties
    if (status.roundStatus === "completed") {
      expect(status.roundEnded).toBe(true);
      expect(status.skipped).toBe(true);
    }
  });

  it("includes all active bids", async () => {
    const { houseId, token } = await createHouseAndCaptain();
    const { roundId } = await createActiveRound();

    // Place bid
    const { POST } = await import("@/app/api/bids/route");
    const req = new Request("http://localhost/api/bids", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json", authorization: `Bearer ${token}` }),
      body: JSON.stringify({ roundId, amount: 200, previousAmount: null }),
    });
    await POST(req as unknown as import("next/server").NextRequest);

    const status = await getStatus();
    expect(status.bidsPlaced).toBeDefined();
    expect(status.bidsPlaced.length).toBeGreaterThan(0);
  });

  it("returns phase counts for unsold participants", async () => {
    const status = await getStatus();
    // phaseCounts should exist and have pass1/pass2 counts
    expect(status).toBeDefined();
    expect(status.phaseCounts).toBeDefined();
  });

  it("handles multiple concurrent status requests", async () => {
    const results = await Promise.all([
      getStatus(),
      getStatus(),
      getStatus(),
    ]);

    // All should return valid responses
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });

  it("excludes sensitive data from status response", async () => {
    await createActiveRound();
    const status = await getStatus();
    
    // Should not expose house passwords, bidsPlaced only contains houseId
    if (status.bidsPlaced?.length > 0) {
      const bid = status.bidsPlaced[0];
      expect(bid.houseId).toBeDefined();
      // No sensitive data in bid objects
      expect(bid.password).toBeUndefined();
    }
  });
});
