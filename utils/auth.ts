import { User } from "@/types";
import { getUser, saveUser, clearUser } from "./storage";

const ADMIN_NAME = "富永大介";

export function isLoggedIn(): boolean {
  const user = getUser();
  return user !== null && user.agreedToCharter;
}

export function isAdmin(): boolean {
  const user = getUser();
  return user !== null && user.isAdmin;
}

export function getCurrentUser(): User | null {
  return getUser();
}

export function login(name: string): User {
  const user: User = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    name,
    agreedToCharter: true,
    agreedAt: new Date().toISOString(),
    isAdmin: name === ADMIN_NAME,
  };
  saveUser(user);
  return user;
}

export function logout(): void {
  clearUser();
}
