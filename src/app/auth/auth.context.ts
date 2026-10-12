import { createContext } from 'react'
import type { AuthSession, Permission } from '../../types/auth'
export type AuthValue = { session: AuthSession | null; can: (permission: Permission) => boolean; canPage: (page: string) => boolean; logout: () => Promise<void>; acceptSession: (session: AuthSession) => void; selectBranch: (id: string) => Promise<void> }
export const AuthContext = createContext<AuthValue | null>(null)
