export const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
export type Role = keyof typeof ROLE_RANK;
