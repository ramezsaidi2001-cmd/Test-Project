import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/domain/tenancy/roles";
import { isDemoMode } from "@/server/auth/demo";
import { getTenantData } from "@/server/store";

export type TeamMember = {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: Role;
  joinedAt: string;
};

export async function listTeamMembers(tenantId: string): Promise<TeamMember[]> {
  if (isDemoMode()) {
    return getTenantData(tenantId).users.map((u) => ({
      userId: u.id,
      fullName: u.name,
      email: u.email,
      role: u.role,
      joinedAt: u.joinedAt,
    }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_members")
    .select("user_id, role, created_at, profile:profiles!inner(full_name, email)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load team members: ${error.message}`);

  return data.map((m) => ({
    userId: m.user_id,
    fullName: m.profile.full_name,
    email: m.profile.email,
    role: m.role,
    joinedAt: m.created_at,
  }));
}
