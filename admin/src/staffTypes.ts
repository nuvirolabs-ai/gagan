export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: { permission: { name: string } }[];
}

export type StaffRole = Pick<Role, "id" | "name" | "description">;

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  employeeRef?: string | null;
  status: "active" | "suspended" | "revoked";
  salesRepId?: string | null;
  managerId?: string | null;
  directReports?: { id: string; name: string; status: string }[];
  roles: { role: StaffRole }[];
  delegationsHeld: {
    id: string;
    startsAt: string;
    endsAt: string;
    role: StaffRole;
    delegator: { id: string; name: string };
  }[];
}

export function readableRole(name: string) {
  return name.replaceAll("_", " ");
}
