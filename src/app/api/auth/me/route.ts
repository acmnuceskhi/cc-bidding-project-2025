import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);

    if (!authResult) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    const { user, payload } = authResult;

    return NextResponse.json({
      id: user._id?.toString(),
      username: user.username,
      role: user.role,
      houseId: user.houseId?.toString() || null,
    });
  } catch (error) {
    console.error("Auth me error:", error);
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
