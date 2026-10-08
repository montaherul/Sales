// Contracts Layer: Data Transfer Objects (DTOs), Schemas & API Interfaces
// Decouples client presentation models from internal database schema
// AGENTS1.md Rule 4 & Rule 22 (API / DTO / ViewModel Rules)

// Identity & Access DTOs
export interface CreateUserDTO {
  email: string;
  fullName: string;
  phone?: string;
  roleName: string;
  companyId?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
  password?: string;
}

export interface UpdateUserDTO {
  id: string;
  fullName?: string;
  phone?: string;
  roleName?: string;
  companyId?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
  isActive?: boolean;
  password?: string;
}

export interface CreateRoleDTO {
  name: string;
  description?: string;
  companyId?: string | null;
  permissionIds?: string[];
}

export interface UpdateRoleDTO {
  id: string;
  name: string;
  description?: string;
  permissionIds?: string[];
}

// Organization & Hierarchy DTOs
export interface CreateCompanyDTO {
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  plan?: string;
  status?: string;
}

export interface UpdateCompanyDTO {
  id: string;
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  plan?: string;
  status?: string;
}

export interface CreateTerritoryDTO {
  name: string;
  regionId: string;
  sortOrder?: number;
}

export interface UpdateTerritoryDTO {
  id: string;
  name: string;
  regionId?: string;
  sortOrder?: number;
}

// Product & Target DTOs
export interface CreateBrandDTO {
  name: string;
  type?: string;
  companyId?: string | null;
  unitPrice?: number;
  sortOrder?: number;
}

export interface UpdateBrandDTO {
  id: string;
  name?: string;
  type?: string;
  unitPrice?: number;
  sortOrder?: number;
}

export interface SetTargetDTO {
  territoryId: string;
  brandId: string;
  month: number;
  year: number;
  targetQuantity: number;
  targetValue?: number;
  companyId?: string | null;
}

// Daily Sales & Stock DTOs
export interface SaveDailySalesDTO {
  territoryId: string;
  saleDate: string;
  sales: Array<{
    brandId: string;
    quantity: number;
    value?: number;
  }>;
  stock?: Array<{
    brandId: string;
    quantity: number;
  }>;
  emptyPackets?: Array<{
    brandId: string;
    quantity: number;
  }>;
  zardaSales?: Array<{
    brandId: string;
    quantity: number;
  }>;
  remarks?: string;
}

export interface SubmitApprovalDTO {
  submissionId: string;
  action: 'TSO_APPROVE' | 'RSO_APPROVE' | 'REJECT' | 'RESUBMIT';
  remarks?: string;
}

// Common Standard API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
