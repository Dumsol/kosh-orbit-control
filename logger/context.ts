import type { LogUser } from './types'

let _currentUser: LogUser | null = null

export function setUser(user: LogUser): void {
  _currentUser = user
}

export function getUser(): LogUser | null {
  return _currentUser
}

export function clearUser(): void {
  _currentUser = null
}
