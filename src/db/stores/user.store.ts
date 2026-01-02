import {db} from "../index";
import {users} from "../schema";
import {eq, and} from "drizzle-orm";

export class UserStore {
  async getUserById(providerUserId: string ,provider?: string) {
    try{
    return await db
    .select()
    .from(users)
    .where(
        and(
           eq(users.providerUserId, providerUserId),
              eq(users.provider, provider || 'default')
    )
    ); 
  }

  catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;  
  }
}
  

   createUser(data : { providerUserId: string, provider: string, username: string, email: string }) {
    try {
      console.log('Creating user with data:', data);
    return db
      .insert(users)
      .values(data)
      .returning();
  }
    catch (error) {
      console.error('Error creating user:', error);
      throw error;  
    }
}
}

export const userStore = new UserStore();     