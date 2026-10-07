// Domain: Identity and Access Models
// Afaz Tobacco Sales & Stock Intelligence Platform

import { RoleType } from '@/shared/constants';

export interface UserEntity {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: RoleType;
  isActive: boolean;
  territoryId?: string | null;
  regionId?: string | null;
  createdAt?: string;
}

export interface MenuAccessRule {
  menuId: string;
  roleName: RoleType;
  canView: boolean;
  canEdit: boolean;
}

export interface UserMenuOverride {
  menuId: string;
  userId: string;
  canView: boolean;
  canEdit: boolean;
}
