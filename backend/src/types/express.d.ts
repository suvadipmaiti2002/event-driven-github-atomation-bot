import { User as DbUser } from "../db/schema";

declare global {
  namespace Express {
    // Augment Passport/Express User to match our database User entity
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends DbUser {}
  }
}
