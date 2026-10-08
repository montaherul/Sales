// Infrastructure: Organization Repository
// Encapsulates database operations for Departments, Positions, and Distributors per tenant

import { dbQuery } from '@/lib/db';
import { Department, Position, Distributor } from '../domain/OrganizationSpecification';

export class OrganizationRepository {
  // ==========================================
  // DEPARTMENTS
  // ==========================================

  public async getDepartments(companyId?: string | null): Promise<Department[]> {
    const params: any[] = [];
    let whereClause = '';

    if (companyId && companyId !== 'ALL') {
      params.push(companyId);
      whereClause = 'WHERE d.company_id = $1';
    }

    const sql = `
      SELECT 
        d.id,
        d.company_id,
        c.name as company_name,
        d.name,
        d.code,
        d.description,
        d.head_user_id,
        u.full_name as head_user_name,
        d.is_active,
        (SELECT COUNT(*) FROM positions p WHERE p.department_id = d.id) as position_count,
        (SELECT COUNT(*) FROM user_profiles up WHERE up.department_id = d.id) as user_count,
        d.created_at,
        d.updated_at
      FROM departments d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN user_profiles u ON d.head_user_id = u.id
      ${whereClause}
      ORDER BY d.name ASC;
    `;

    const res = await dbQuery<Department>(sql, params);
    return res.rows;
  }

  public async getDepartmentById(id: string): Promise<Department | null> {
    const res = await dbQuery<Department>(
      `SELECT d.*, c.name as company_name, u.full_name as head_user_name
       FROM departments d
       LEFT JOIN companies c ON d.company_id = c.id
       LEFT JOIN user_profiles u ON d.head_user_id = u.id
       WHERE d.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  public async createDepartment(
    companyId: string,
    data: { name: string; code?: string; description?: string; head_user_id?: string }
  ): Promise<Department> {
    const res = await dbQuery<Department>(
      `INSERT INTO departments (company_id, name, code, description, head_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [companyId, data.name, data.code || null, data.description || null, data.head_user_id || null]
    );
    return res.rows[0];
  }

  public async updateDepartment(
    id: string,
    data: { name?: string; code?: string; description?: string; head_user_id?: string; is_active?: boolean }
  ): Promise<Department> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.code !== undefined) {
      setClauses.push(`code = $${paramIndex++}`);
      params.push(data.code || null);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(data.description || null);
    }
    if (data.head_user_id !== undefined) {
      setClauses.push(`head_user_id = $${paramIndex++}`);
      params.push(data.head_user_id || null);
    }
    if (data.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(data.is_active);
    }

    const res = await dbQuery<Department>(
      `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`,
      params
    );
    return res.rows[0];
  }

  public async deleteDepartment(id: string): Promise<boolean> {
    const res = await dbQuery('DELETE FROM departments WHERE id = $1;', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ==========================================
  // POSITIONS (Hierarchy & Designations)
  // ==========================================

  public async getPositions(
    companyId?: string | null,
    departmentId?: string | null
  ): Promise<Position[]> {
    const params: any[] = [];
    const whereClauses: string[] = [];
    let paramIndex = 1;

    if (companyId && companyId !== 'ALL') {
      whereClauses.push(`p.company_id = $${paramIndex++}`);
      params.push(companyId);
    }
    if (departmentId) {
      whereClauses.push(`p.department_id = $${paramIndex++}`);
      params.push(departmentId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.id,
        p.company_id,
        c.name as company_name,
        p.department_id,
        d.name as department_name,
        p.name,
        p.code,
        p.level,
        p.parent_position_id,
        parent.name as parent_position_name,
        p.default_role_id,
        r.name as default_role_name,
        p.description,
        p.is_active,
        (SELECT COUNT(*) FROM user_profiles up WHERE up.position_id = p.id) as user_count,
        p.created_at,
        p.updated_at
      FROM positions p
      LEFT JOIN companies c ON p.company_id = c.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN positions parent ON p.parent_position_id = parent.id
      LEFT JOIN roles r ON p.default_role_id = r.id
      ${where}
      ORDER BY p.level ASC, p.name ASC;
    `;

    const res = await dbQuery<Position>(sql, params);
    return res.rows;
  }

  public async getPositionById(id: string): Promise<Position | null> {
    const res = await dbQuery<Position>(
      `SELECT p.*, c.name as company_name, d.name as department_name, parent.name as parent_position_name
       FROM positions p
       LEFT JOIN companies c ON p.company_id = c.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN positions parent ON p.parent_position_id = parent.id
       WHERE p.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  public async createPosition(
    companyId: string,
    data: {
      department_id: string;
      name: string;
      code?: string;
      level?: number;
      parent_position_id?: string;
      default_role_id?: string;
      description?: string;
    }
  ): Promise<Position> {
    const res = await dbQuery<Position>(
      `INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, default_role_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [
        companyId,
        data.department_id,
        data.name,
        data.code || null,
        data.level ?? 5,
        data.parent_position_id || null,
        data.default_role_id || null,
        data.description || null,
      ]
    );
    return res.rows[0];
  }

  public async updatePosition(
    id: string,
    data: {
      department_id?: string;
      name?: string;
      code?: string;
      level?: number;
      parent_position_id?: string | null;
      default_role_id?: string | null;
      description?: string;
      is_active?: boolean;
    }
  ): Promise<Position> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (data.department_id !== undefined) {
      setClauses.push(`department_id = $${paramIndex++}`);
      params.push(data.department_id);
    }
    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.code !== undefined) {
      setClauses.push(`code = $${paramIndex++}`);
      params.push(data.code || null);
    }
    if (data.level !== undefined) {
      setClauses.push(`level = $${paramIndex++}`);
      params.push(data.level);
    }
    if (data.parent_position_id !== undefined) {
      setClauses.push(`parent_position_id = $${paramIndex++}`);
      params.push(data.parent_position_id || null);
    }
    if (data.default_role_id !== undefined) {
      setClauses.push(`default_role_id = $${paramIndex++}`);
      params.push(data.default_role_id || null);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(data.description || null);
    }
    if (data.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(data.is_active);
    }

    const res = await dbQuery<Position>(
      `UPDATE positions SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`,
      params
    );
    return res.rows[0];
  }

  public async deletePosition(id: string): Promise<boolean> {
    const res = await dbQuery('DELETE FROM positions WHERE id = $1;', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ==========================================
  // DISTRIBUTORS (Channel Partners)
  // ==========================================

  public async getDistributors(
    companyId?: string | null,
    territoryId?: string | null
  ): Promise<Distributor[]> {
    const params: any[] = [];
    const whereClauses: string[] = [];
    let paramIndex = 1;

    if (companyId && companyId !== 'ALL') {
      whereClauses.push(`dist.company_id = $${paramIndex++}`);
      params.push(companyId);
    }
    if (territoryId) {
      whereClauses.push(`dist.territory_id = $${paramIndex++}`);
      params.push(territoryId);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT 
        dist.id,
        dist.company_id,
        c.name as company_name,
        dist.name,
        dist.code,
        dist.proprietor_name,
        dist.phone,
        dist.email,
        dist.address,
        dist.territory_id,
        t.name as territory_name,
        dist.status,
        dist.created_at,
        dist.updated_at
      FROM distributors dist
      LEFT JOIN companies c ON dist.company_id = c.id
      LEFT JOIN territories t ON dist.territory_id = t.id
      ${where}
      ORDER BY dist.name ASC;
    `;

    const res = await dbQuery<Distributor>(sql, params);
    return res.rows;
  }

  public async createDistributor(
    companyId: string,
    data: {
      name: string;
      code?: string;
      proprietor_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      territory_id?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    }
  ): Promise<Distributor> {
    const res = await dbQuery<Distributor>(
      `INSERT INTO distributors (company_id, name, code, proprietor_name, phone, email, address, territory_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        companyId,
        data.name,
        data.code || null,
        data.proprietor_name || null,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.territory_id || null,
        data.status || 'ACTIVE',
      ]
    );
    return res.rows[0];
  }

  public async updateDistributor(
    id: string,
    data: {
      name?: string;
      code?: string;
      proprietor_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      territory_id?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    }
  ): Promise<Distributor> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.code !== undefined) {
      setClauses.push(`code = $${paramIndex++}`);
      params.push(data.code || null);
    }
    if (data.proprietor_name !== undefined) {
      setClauses.push(`proprietor_name = $${paramIndex++}`);
      params.push(data.proprietor_name || null);
    }
    if (data.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      params.push(data.phone || null);
    }
    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(data.email || null);
    }
    if (data.address !== undefined) {
      setClauses.push(`address = $${paramIndex++}`);
      params.push(data.address || null);
    }
    if (data.territory_id !== undefined) {
      setClauses.push(`territory_id = $${paramIndex++}`);
      params.push(data.territory_id || null);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }

    const res = await dbQuery<Distributor>(
      `UPDATE distributors SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`,
      params
    );
    return res.rows[0];
  }

  public async deleteDistributor(id: string): Promise<boolean> {
    const res = await dbQuery('DELETE FROM distributors WHERE id = $1;', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ==========================================
  // TEMPLATE PROVISIONER
  // ==========================================

  public async provisionTemplate(companyId: string): Promise<any> {
    const res = await dbQuery(
      `SELECT sp_provision_tenant_template($1) as result;`,
      [companyId]
    );
    return res.rows[0]?.result;
  }
}

export const organizationRepository = new OrganizationRepository();
