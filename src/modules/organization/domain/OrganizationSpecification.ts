// Domain: Organization & Tenant Hierarchy Specification
// Configurable per-tenant: Department -> Position -> User -> Role/Permissions -> Scope

export interface Department {
  id: string;
  company_id: string;
  company_name?: string;
  name: string;
  code?: string | null;
  description?: string | null;
  head_user_id?: string | null;
  head_user_name?: string | null;
  is_active: boolean;
  position_count?: number;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Position {
  id: string;
  company_id: string;
  company_name?: string;
  department_id: string;
  department_name?: string;
  name: string;
  code?: string | null;
  level: number; // 1=CEO, 2=Director, 3=HOD, 4=Regional, 5=Area/ASM, 6=Territory/TSO, 7=Supervisor, 8=Field/CSR
  parent_position_id?: string | null;
  parent_position_name?: string | null;
  default_role_id?: string | null;
  default_role_name?: string | null;
  description?: string | null;
  is_active: boolean;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Distributor {
  id: string;
  company_id: string;
  company_name?: string;
  name: string;
  code?: string | null;
  proprietor_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  territory_id?: string | null;
  territory_name?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at?: string;
  updated_at?: string;
}

export type ScopeLevel = 'TENANT' | 'REGION' | 'AREA' | 'TERRITORY' | 'ROUTE' | 'OUTLET';
