"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEMO_MEMBER_COOKIE } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { DEMO_MEMBERS } from "@/lib/demo/members";

/** Demo mode only: switch which sample family member you are viewing as. */
export async function switchDemoMemberAction(userId: string): Promise<void> {
  if (dataMode() !== "demo") return;
  if (!DEMO_MEMBERS.some((m) => m.userId === userId)) return;
  const jar = await cookies();
  jar.set(DEMO_MEMBER_COOKIE, userId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
}
