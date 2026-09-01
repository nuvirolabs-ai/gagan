import { createContext } from "react";

export interface Admin {
  id: string;
  name: string;
  email: string;
}

export interface AuthValue {
  admin: Admin | null;
  /**
   * The StaffUser behind the login. Reporting scope, self-approval and "is this
   * my own row" are all questions about the employee, not the portal account.
   */
  staffId: string | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | undefined>(undefined);
