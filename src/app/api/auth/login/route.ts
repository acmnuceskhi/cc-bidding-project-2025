import { NextRequest, NextResponse } from "next/server";
import { Users } from "@/lib/models/users";
import { verifyPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_CREDENTIALS",
          message: "Username and password are required"
        },
        { status: 400 }
      );
    }

    // Find user by username
    const user = await Users.findByUsername(username);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Username or password incorrect"
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Username or password incorrect"
        },
        { status: 401 }
      );
    }

    // Update last login
    await Users.updateLastLogin(user._id!.toString());

    // Generate JWT token
    const tokenPayload = {
      userId: user._id!.toString(),
      username: user.username,
      role: user.role,
      houseId: user.houseId?.toString()
    };
    
    console.log("Generating token for user:", tokenPayload);
    const token = generateToken(tokenPayload);

    return NextResponse.json({
      success: true,
      token,
      role: user.role,
      houseId: user.houseId?.toString()
    });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Internal server error"
      },
      { status: 500 }
    );
  }
}