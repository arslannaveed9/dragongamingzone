import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";
import { connectDB } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { User } from "@/models/user";
import { getSettings } from "@/services/settings-service";

const globalState = globalThis as typeof globalThis & { __gzBootstrapped?: boolean };

export async function ensureBootstrap() {
  if (globalState.__gzBootstrapped) return;
  await connectDB();
  await getSettings();
  const count = await User.countDocuments();
  if (count === 0) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 8) {
      throw new AppError(
        500,
        "CONFIG",
        "No staff accounts exist. Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) to create the owner.",
      );
    }
    await User.create({
      name: "Owner",
      email,
      passwordHash: await hashPassword(password),
      role: "owner",
      active: true,
    });
  }
  globalState.__gzBootstrapped = true;
}

export async function authenticate(email: string, password: string) {
  await ensureBootstrap();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !user.active) {
    throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect.");
  }
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect.");
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
