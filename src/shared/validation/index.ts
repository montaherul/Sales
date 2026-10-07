// Shared Validation Schemas using Zod
// Afaz Tobacco Sales & Stock Intelligence Platform

import { z } from 'zod';

export const CigaretteBrandSalesSchema = z.object({
  wilson: z.number().min(0).default(0),
  shahara: z.number().min(0).default(0),
  express: z.number().min(0).default(0),
  nexus: z.number().min(0).default(0),
  sb: z.number().min(0).default(0),
  sm: z.number().min(0).default(0),
});

export const CigaretteBrandStockSchema = z.object({
  wilson: z.number().min(0).default(0),
  shahara: z.number().min(0).default(0),
  express: z.number().min(0).default(0),
  nexus: z.number().min(0).default(0),
  sb: z.number().min(0).default(0),
  sm: z.number().min(0).default(0),
});

export const ZardaSalesSchema = z.object({
  slb: z.number().min(0).default(0),
  qty_22_25: z.number().int().min(0).default(0),
  qty_99_14: z.number().int().min(0).default(0),
  qty_33_15: z.number().int().min(0).default(0),
});

export const ZardaStockSchema = z.object({
  slb: z.number().min(0).default(0),
  qty_22_25: z.number().int().min(0).default(0),
  qty_99_14: z.number().int().min(0).default(0),
  qty_33_15: z.number().int().min(0).default(0),
});

export const EmptyPacketsSchema = z.object({
  wilson: z.number().min(0).default(0),
  shahara: z.number().min(0).default(0),
  express: z.number().min(0).default(0),
  nexus: z.number().min(0).default(0),
  sb: z.number().min(0).default(0),
  sm: z.number().min(0).default(0),
});

export const DailySubmissionInputSchema = z.object({
  territoryId: z.string().min(1, 'Territory ID is required'),
  reportingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  status: z.enum(['DRAFT', 'SUBMITTED', 'TSO_APPROVED', 'RSO_APPROVED', 'FINALIZED', 'REJECTED']).default('DRAFT'),
  remarks: z.string().optional().default(''),
  cigaretteSales: CigaretteBrandSalesSchema,
  cigaretteStock: CigaretteBrandStockSchema,
  zardaSales: ZardaSalesSchema,
  zardaStock: ZardaStockSchema,
  emptyPackets: EmptyPacketsSchema.optional(),
});

export const WorkflowTransitionInputSchema = z.object({
  id: z.string().min(1, 'Submission ID is required'),
  action: z.enum(['SUBMIT', 'APPROVE', 'REJECT', 'UNLOCK']),
  reason: z.string().optional(),
});

export const UserCreateInputSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  roleName: z.enum(['SUPER_ADMIN', 'RSO', 'TSO', 'CSR']),
  territoryId: z.string().optional(),
  phone: z.string().optional(),
});
