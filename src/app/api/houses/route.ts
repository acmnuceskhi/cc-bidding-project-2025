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
      totalBudget: house.totalBudget,
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
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json({ error: "Missing house ID" }, { status: 400 });
    }

    const body = await request.json();

    // Validate fields and enforce invariants
    const update: Partial<{
      name: string;
      totalBudget: number;
      remainingBudget: number;
    }> = {};
    const errors: string[] = [];

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        errors.push("Name must be a non-empty string");
      } else {
        update.name = body.name.trim();
      }
    }

    if (body.totalBudget !== undefined) {
      if (typeof body.totalBudget !== "number" || body.totalBudget < 0) {
        errors.push("totalBudget must be a non-negative number");
      } else {
        update.totalBudget = body.totalBudget;
      }
    }

    if (body.remainingBudget !== undefined) {
      if (
        typeof body.remainingBudget !== "number" ||
        body.remainingBudget < 0
      ) {
        errors.push("remainingBudget must be a non-negative number");
      } else {
        update.remainingBudget = body.remainingBudget;
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: errors },
        { status: 400 }
      );
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "NO_VALID_FIELDS", message: "No valid fields to update" },
        { status: 400 }
      );
    }

    const existing = await Houses.getById(id);
    if (!existing) {
      return NextResponse.json({ error: "House not found" }, { status: 404 });
    }

    // Prevent totalBudget shrinking below remainingBudget (prospective)
    if (update.totalBudget !== undefined) {
      const prospectiveRemaining =
        update.remainingBudget !== undefined
          ? update.remainingBudget
          : existing.remainingBudget;
      if (update.totalBudget < prospectiveRemaining) {
        return NextResponse.json(
          {
            error: "INVALID_INVARIANT",
            message: "totalBudget cannot be less than remainingBudget",
          },
          { status: 400 }
        );
      }
    }

    // Prevent remainingBudget exceeding totalBudget (effective)
    if (update.remainingBudget !== undefined) {
      const effectiveTotal = update.totalBudget ?? existing.totalBudget;
      if (update.remainingBudget > effectiveTotal) {
        return NextResponse.json(
          {
            error: "INVALID_INVARIANT",
            message: "remainingBudget cannot exceed totalBudget",
          },
          { status: 400 }
        );
      }
    }

    // Update the house with sanitized payload
    const result = await Houses.update(id, update);

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "House not found" }, { status: 404 });
    }

    const updated = await Houses.getById(id);

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
      house: updated
        ? {
            houseId: updated._id?.toString(),
            name: updated.name,
            totalBudget: updated.totalBudget,
            remainingBudget: updated.remainingBudget,
          }
        : null,
    });
  } catch (error) {
    console.error("Error updating house:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
