import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { Users } from "@/lib/models/users";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "NOT_AUTHENTICATED" },
        { status: 401 }
      );
    }

    const { user } = auth;

    // Invalidate session
    await Users.update(user._id!.toString(), {
      activeSessionToken: null,
      lastActiveAt: null,
    });

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
