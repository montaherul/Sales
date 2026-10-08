// Application: Company Service
// Coordinates tenant management workflows, automatic admin provisioning, and audit logs
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { companyRepository, CompanyFilterOptions } from '../infrastructure/CompanyRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { AuditService } from '@/modules/audit';

export interface CreateCompanyDTO {
  name: string;
  code: string;
  status?: string;
  plan?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  createAdminUser?: boolean;
  adminEmail?: string;
  adminPassword?: string;
  adminFullName?: string;
  adminPhone?: string;
}

export interface UpdateCompanyDTO {
  id: string;
  name?: string;
  code?: string;
  status?: string;
  plan?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  currency?: string;
  timezone?: string;
}

export class CompanyService {
  /**
   * Retrieves paginated companies with tenant scoping for non-Super Admins.
   */
  public static async getCompaniesPaginated(
    options: CompanyFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    const result = await companyRepository.getPaginatedCompanies(options);

    // Server-side scope: Non-super admins only see their assigned company
    if (actor.role !== ROLES.SUPER_ADMIN) {
      const filtered = (result.data || []).filter((c: any) => c.id === actor.companyId);
      return {
        data: filtered,
        pagination: {
          page: 1,
          pageSize: filtered.length,
          totalRecords: filtered.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    return result;
  }

  /**
   * Generates CSV export for companies.
   */
  public static async exportCompaniesCsv(
    options: CompanyFilterOptions,
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getCompaniesPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Company ID',
      name: 'Company Name',
      code: 'Company Code',
      division_count: 'Total Divisions',
      territory_count: 'Total Territories',
      user_count: 'Assigned Users',
      created_at: 'Created Date',
    });
  }

  /**
   * Creates a new company tenant with optional automated Company Admin user setup.
   */
  public static async createCompany(dto: CreateCompanyDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create companies');
    }

    if (!dto.name || !dto.name.trim()) throw new ValidationError('Company Name is required');
    if (!dto.code || !dto.code.trim()) throw new ValidationError('Company Code is required');

    const cleanCode = dto.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const existing = await companyRepository.getCompanyByCode(cleanCode);
    if (existing) {
      throw new ValidationError(`Company code "${cleanCode}" is already in use`);
    }

    const companyId = crypto.randomUUID();

    const newCompany = await companyRepository.createCompany({
      id: companyId,
      name: dto.name.trim(),
      code: cleanCode,
      status: dto.status || 'ACTIVE',
      plan: dto.plan || 'PRO',
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      address: dto.address,
      currency: dto.currency || 'BDT',
      timezone: dto.timezone || 'Asia/Dhaka',
    });

    // Create default company settings
    try {
      await dbQuery(
        `INSERT INTO company_settings (company_id, key, value)
         VALUES ($1, 'DEFAULT_WORKING_DAYS', '26')
         ON CONFLICT DO NOTHING`,
        [companyId]
      );
    } catch (setErr) {
      logger.warn('Could not insert default company settings', 'CompanyService', { setErr });
    }

    // Provision default company admin user if requested
    let createdAdminUser = null;
    if (dto.createAdminUser && dto.adminEmail) {
      try {
        const adminRoleRes = await dbQuery(`SELECT id FROM roles WHERE name = 'COMPANY_ADMIN' LIMIT 1`);
        const adminRoleId = adminRoleRes.rows[0]?.id;
        const passwordHash = await bcrypt.hash(dto.adminPassword || '123', 10);
        const adminUserId = crypto.randomUUID();

        await dbQuery(
          `INSERT INTO user_profiles (
            id, email, password_hash, full_name, phone, role, role_id, company_id, is_active
          ) VALUES ($1, $2, $3, $4, $5, 'COMPANY_ADMIN', $6, $7, TRUE)`,
          [
            adminUserId,
            dto.adminEmail.toLowerCase().trim(),
            passwordHash,
            dto.adminFullName || `${dto.name} Admin`,
            dto.adminPhone || null,
            adminRoleId,
            companyId,
          ]
        );

        await dbQuery(
          `INSERT INTO user_scopes (user_id, company_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id`,
          [adminUserId, companyId]
        );

        createdAdminUser = { id: adminUserId, email: dto.adminEmail };
      } catch (adminErr) {
        logger.warn('Could not auto-create company admin user', 'CompanyService', { adminErr });
      }
    }

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'companies',
      entityId: companyId,
      newValues: { name: dto.name, code: cleanCode, plan: dto.plan },
    });

    return { ...newCompany, createdAdminUser };
  }

  /**
   * Updates company tenant details.
   */
  public static async updateCompany(dto: UpdateCompanyDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.companyId !== dto.id) {
      throw new ForbiddenError('You can only update your assigned company');
    }

    const existing = await companyRepository.getCompanyById(dto.id);
    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeDuplicate = await companyRepository.getCompanyByCode(dto.code);
      if (codeDuplicate && codeDuplicate.id !== dto.id) {
        throw new ValidationError(`Company code "${dto.code}" is already in use`);
      }
    }

    const updated = await companyRepository.updateCompany(dto);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: dto.id,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'companies',
      entityId: dto.id,
      oldValues: { name: existing.name, status: existing.status },
      newValues: { name: dto.name, status: dto.status },
    });

    return updated;
  }

  /**
   * Deletes company tenants.
   */
  public static async deleteCompanies(ids: string[], actor: UserAuthContext): Promise<number> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete companies');
    }

    if (ids.length === 0) {
      throw new ValidationError('At least one Company ID is required');
    }

    await companyRepository.deleteCompanies(ids);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'companies',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

    return ids.length;
  }

  /**
   * Retrieves SaaS platform aggregate stats. SUPER_ADMIN only.
   */
  public static async getPlatformStats(actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can view SaaS platform statistics');
    }
    return await companyRepository.getPlatformStats();
  }
}
