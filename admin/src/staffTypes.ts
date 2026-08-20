export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: { permission: { name: string } }[];
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  employeeRef?: string | null;
  status: "active" | "suspended" | "revoked";
  roles: { role: Role }[];
  delegationsHeld: {
    id: string;
    startsAt: string;
    endsAt: string;
    role: Role;
    delegator: { id: string; name: string };
  }[];
}

export function readableRole(name: string) {
  return name.replaceAll("_", " ");
}
