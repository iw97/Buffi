import type { User } from "firebase/auth";

export function userHasEmailPasswordProvider(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === "password");
}
