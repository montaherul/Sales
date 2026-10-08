// Infrastructure: Menu Access Repository
// Data-Access layer handling system menus, role access (RWMA), and user override access (UWMA)
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { getDbPool } from '@/lib/db';

export interface MenuAccessMatrixData {
  menus: any[];
  rwma: any[];
  uwma: any[];
  users: any[];
  activeScopeCompanyId: string | null;
}

export class MenuAccessRepository {
  public async getMatrixData(filterCompanyId: string | null): Promise<MenuAccessMatrixData> {
    if (!getDbPool()) {
      return {
        menus: [],
        rwma: [],
        uwma: [],
        users: [],
        activeScopeCompanyId: filterCompanyId,
      };
    }

    // 1. Fetch system menus
    const menusRes = await dbQuery(`
      SELECT id, title, category, icon, description, sort_order
      FROM system_menus
      ORDER BY sort_order ASC;
    `);

    // 2. Fetch role menu access (RWMA)
    const rwmaRes = await dbQuery(`
      SELECT role_name, menu_id, can_view, can_edit
      FROM role_menu_access;
    `);

    // 3. Fetch user menu access (UWMA) with user profiles scoped to company
    const uwmaSql = filterCompanyId
      ? `SELECT uma.user_id, u.email, u.full_name, r.name as role_name, uma.menu_id, uma.can_view, uma.can_edit
         FROM user_menu_access uma
         JOIN user_profiles u ON uma.user_id = u.id
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN user_scopes us ON u.id = us.user_id
         WHERE us.company_id = $1;`
      : `SELECT uma.user_id, u.email, u.full_name, r.name as role_name, uma.menu_id, uma.can_view, uma.can_edit
         FROM user_menu_access uma
         JOIN user_profiles u ON uma.user_id = u.id
         JOIN roles r ON u.role_id = r.id;`;
    const uwmaParams = filterCompanyId ? [filterCompanyId] : [];
    const uwmaRes = await dbQuery(uwmaSql, uwmaParams);

    // 4. Fetch all user profiles for selection (scoped to company)
    const usersSql = filterCompanyId
      ? `SELECT u.id, u.email, u.full_name, r.name as role_name, u.is_active
         FROM user_profiles u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN user_scopes us ON u.id = us.user_id
         WHERE us.company_id = $1
         ORDER BY u.full_name;`
      : `SELECT u.id, u.email, u.full_name, r.name as role_name, u.is_active
         FROM user_profiles u
         JOIN roles r ON u.role_id = r.id
         ORDER BY u.full_name;`;
    const usersParams = filterCompanyId ? [filterCompanyId] : [];
    const usersRes = await dbQuery(usersSql, usersParams);

    return {
      menus: menusRes.rows,
      rwma: rwmaRes.rows,
      uwma: uwmaRes.rows,
      users: usersRes.rows,
      activeScopeCompanyId: filterCompanyId,
    };
  }

  public async updateRoleMenuAccess(roleName: string, menuId: string, canView: boolean, canEdit: boolean): Promise<void> {
    await dbQuery(`
      INSERT INTO role_menu_access (role_name, menu_id, can_view, can_edit)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (role_name, menu_id) DO UPDATE
      SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;
    `, [roleName, menuId, canView, canEdit]);
  }

  public async updateUserMenuAccess(userId: string, menuId: string, canView: boolean, canEdit: boolean): Promise<void> {
    await dbQuery(`
      INSERT INTO user_menu_access (user_id, menu_id, can_view, can_edit)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, menu_id) DO UPDATE
      SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;
    `, [userId, menuId, canView, canEdit]);
  }
}

export const menuAccessRepository = new MenuAccessRepository();
