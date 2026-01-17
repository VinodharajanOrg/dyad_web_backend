import {db} from "../index";
import {sessions} from "../schema";

export class SessionStore {

    createSession(data : { userId: string, provider: string, accessToken: string, refreshToken?: string, sessionToken: string, expiresAt: Date }) { 
        return db
          .insert(sessions)
          .values(data)
          .returning();
    }

}

export const sessionStore = new SessionStore();

