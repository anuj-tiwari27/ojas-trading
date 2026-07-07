export interface RequestUser {
  id: string;
  email: string;
  companyId: string;
  branchId?: string | null;
  isSuperAdmin: boolean;
  roles: string[]; // role keys
  permissions: string[]; // permission keys, e.g. "trade:create"
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}
