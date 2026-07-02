import { Account, ID, type Client, type Models } from "appwrite";

export interface AuthService {
  login(email: string, password: string): Promise<Models.Session>;
  signup(email: string, password: string, name?: string): Promise<Models.User<Models.Preferences>>;
  logout(): Promise<void>;
  currentUser(): Promise<Models.User<Models.Preferences> | null>;
}

export function createAuthService(client: Client): AuthService {
  const account = new Account(client);
  return {
    async login(email, password) {
      return account.createEmailPasswordSession(email, password);
    },
    async signup(email, password, name) {
      return account.create(ID.unique(), email, password, name);
    },
    async logout() {
      await account.deleteSession("current");
    },
    async currentUser() {
      try {
        return await account.get();
      } catch {
        return null;
      }
    },
  };
}
