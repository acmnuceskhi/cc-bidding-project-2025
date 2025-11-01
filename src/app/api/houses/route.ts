import { NextResponse } from "next/server";
import { Houses } from "@/lib/models/houses";

// GET /api/houses - Get all houses with their budgets
export async function GET() {
  try {
    const houses = await Houses.getAll();
    return NextResponse.json(houses);
  } catch (error) {
    console.error("Error fetching houses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/houses/:id - Update house budget (admin only)
export async function PUT(request: Request) {
  try {
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