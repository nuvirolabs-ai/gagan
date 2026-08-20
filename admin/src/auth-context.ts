import { createContext } from "react";

export interface Admin {
  id: string;
  name: string;
  email: string;
}

export interface AuthValue {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | undefined>(undefined);
