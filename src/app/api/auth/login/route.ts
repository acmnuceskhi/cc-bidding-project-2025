import { NextRequest, NextResponse } from "next/server";
import { Users } from "@/lib/models/users";
import { verifyPassword, generateToken, SESSION_TIMEOUT_MINUTES } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_CREDENTIALS",
          message: "Username and password are required",
        },
        { status: 400 }
      );
    }

    // Find user
    const user = await Users.findByUsername(username);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "Username or password incorrect",
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
          message: "Username or password incorrect",
        },
        { status: 401 }
      );
    }

    // Check if user already has an active session
    // if (user.activeSessionToken && user.lastActiveAt) {
    //       const minutesSinceLastActive =
    //         (Date.now() - new Date(user.lastActiveAt).getTime()) / (1000 * 60);

    //       if (minutesSinceLastActive < SESSION_TIMEOUT_MINUTES) {
    //         return NextResponse.json(
    //           {
    //             success: false,
    //             error: "ALREADY_LOGGED_IN",
    //             message: `User is already logged in elsewhere. Please wait ${Math.ceil(
    //               SESSION_TIMEOUT_MINUTES - minutesSinceLastActive
    //             )} minutes or log out from that device.`,
    //           },
    //           { status: 403 }
    //         );
    //       }

      // Session is stale → clear it before logging in again
      // await Users.update(user._id!.toString(), {
      //         activeSessionToken: null,
      //         lastActiveAt: null,
      //       });
      //     }

    // Generate new JWT session token
    const tokenPayload = {
      userId: user._id!.toString(),
      username: user.username,
      role: user.role,
      houseId: user.houseId?.toString(),
    };

    const token = generateToken(tokenPayload);

    // Store session in DB
    await Users.update(user._id!.toString(), {
      activeSessionToken: token,
      lastActiveAt: new Date(),
      lastLogin: new Date(),
    });

    return NextResponse.json({
      success: true,
      token,
      role: user.role,
      houseId: user.houseId?.toString(),
    });
  } catch (error) {
    console.error("Login error:", error);
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