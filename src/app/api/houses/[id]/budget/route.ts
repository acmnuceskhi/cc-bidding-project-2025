import { NextRequest, NextResponse } from "next/server";
import { Houses } from "@/lib/models/houses";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

// PATCH /api/houses/[id]/budget - Admin adjusts house budget
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication & authorization
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate house ID
    const { id } = await context.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "Invalid or missing house ID" },
        { status: 400 }
      );
    }

    // Get existing house
    const house = await Houses.getById(id);
    if (!house) {
      return NextResponse.json(
        { error: "HOUSE_NOT_FOUND", message: "House not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { totalBudget, adjustRemainingBy } = body;

    // Validate at least one field is provided
    if (totalBudget === undefined && adjustRemainingBy === undefined) {
      return NextResponse.json(
        {
          error: "MISSING_FIELDS",
          message: "Provide at least one of: totalBudget, adjustRemainingBy",
        },
        { status: 400 }
      );
    }

    // Validate types and ranges
    if (totalBudget !== undefined) {
      if (typeof totalBudget !== "number" || totalBudget < 0) {
        return NextResponse.json(
          {
            error: "INVALID_TOTAL_BUDGET",
            message: "totalBudget must be a non-negative number",
          },
          { status: 400 }
        );
      }
    }

    if (adjustRemainingBy !== undefined) {
      if (typeof adjustRemainingBy !== "number") {
        return NextResponse.json(
          {
            error: "INVALID_ADJUSTMENT",
            message: "adjustRemainingBy must be a number",
          },
          { status: 400 }
        );
      }
    }

    // Calculate new values
    let newTotalBudget = house.totalBudget;
    let newRemainingBudget = house.remainingBudget;

    if (totalBudget !== undefined) {
      // Update total budget
      const currentSpent = house.totalBudget - house.remainingBudget;
      newTotalBudget = totalBudget;
      newRemainingBudget = totalBudget - currentSpent;

      // Prevent negative remaining budget
      if (newRemainingBudget < 0) {
        return NextResponse.json(
          {
            error: "BUDGET_CONSTRAINT_VIOLATION",
            message: `Cannot set totalBudget to ${totalBudget}. House has already spent ${currentSpent}, which would result in negative remaining budget (${newRemainingBudget}).`,
            currentSpent,
            proposedTotal: totalBudget,
            resultingRemaining: newRemainingBudget,
          },
          { status: 409 }
        );
      }
    }

    if (adjustRemainingBy !== undefined) {
      // Adjust remaining budget by delta
      newRemainingBudget += adjustRemainingBy;

      // Prevent negative remaining budget
      if (newRemainingBudget < 0) {
        return NextResponse.json(
          {
            error: "INSUFFICIENT_BUDGET",
            message: `Cannot adjust remaining budget by ${adjustRemainingBy}. Current remaining is ${house.remainingBudget}, which would result in ${newRemainingBudget}.`,
            currentRemaining: house.remainingBudget,
            adjustment: adjustRemainingBy,
            resultingRemaining: newRemainingBudget,
          },
          { status: 409 }
        );
      }

      // Note: totalBudget remains unchanged when adjusting remaining budget
    }

    // Apply update
    await Houses.update(id, {
      totalBudget: newTotalBudget,
      remainingBudget: newRemainingBudget,
    });

    // Fetch updated house
    const updatedHouse = await Houses.getById(id);


    return NextResponse.json({
      success: true,
      message: "House budget updated successfully",
      house: {
        id: updatedHouse!._id?.toString(),
        name: updatedHouse!.name,
        totalBudget: updatedHouse!.totalBudget,
        remainingBudget: updatedHouse!.remainingBudget,
        spent: updatedHouse!.totalBudget - updatedHouse!.remainingBudget,
      },
      changes: {
        totalBudget: {
          before: house.totalBudget,
          after: newTotalBudget,
          delta: newTotalBudget - house.totalBudget,
        },
        remainingBudget: {
          before: house.remainingBudget,
          after: newRemainingBudget,
          delta: newRemainingBudget - house.remainingBudget,
        },
      },
    });
  } catch (error) {
    console.error("Error adjusting house budget:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}
