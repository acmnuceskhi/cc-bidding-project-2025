import { NextRequest, NextResponse } from "next/server";
import { Houses } from "@/lib/models/houses";
import { verifyAuth, hasRole } from "@/lib/auth";

// GET /api/houses - Get all houses with their budgets
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch all houses
    const houses = await Houses.getAll();

    // Transform to include only houseId, name, and remainingBudget
    const filteredHouses = houses.map((house) => ({
      houseId: house._id?.toString(),
      name: house.name,
      remainingBudget: house.remainingBudget,
    }));

    return NextResponse.json(filteredHouses);
  } catch (error) {
    console.error("Error fetching houses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/houses/:id - Update house budget (admin only)
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify admin role
    if (!hasRole(authResult.payload, 'admin')) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json(
        { error: "Missing house ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Update the house
    const result = await Houses.update(id, body);

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "House not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error updating house:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}