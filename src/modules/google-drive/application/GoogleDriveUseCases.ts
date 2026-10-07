// Application: Google Drive Use Cases
// Super Admin cloud archival with SHA-256 checksum, versioning, and audit logging

import { googleDriveAdapter, DriveUploadResult } from '@/infrastructure/google/GoogleDriveAdapter';
import { ExcelExportService } from '@/modules/excel-export';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError } from '@/shared/errors';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';

export interface DriveArchiveRequestDTO {
  year: number;
  month: number;
  day: number;
  user: UserAuthContext;
}

export class GoogleDriveService {
  /**
   * Uploads an authoritative monthly workbook to Google Drive.
   * Strictly restricted to SUPER_ADMIN role.
   */
  public static async archiveReport(dto: DriveArchiveRequestDTO): Promise<DriveUploadResult> {
    // 1. Authorization check: Super Admin ONLY
    if (dto.user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN users are permitted to upload reports to Google Drive');
    }

    // 2. Generate authoritative 34-sheet workbook
    const { filename, buffer } = await ExcelExportService.generateMonthlyReport(
      dto.year,
      dto.month,
      dto.day,
      dto.user.id
    );

    // 3. Upload through adapter
    const uploadResult = await googleDriveAdapter.uploadReport({
      fileName: filename,
      fileBuffer: buffer,
      year: dto.year,
      month: dto.month,
      day: dto.day,
      uploadedBy: dto.user.id,
    });

    // 4. Centralized Audit Log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          dto.user.id,
          AUDIT_ACTIONS.GOOGLE_UPLOAD,
          'google_drive_files',
          uploadResult.fileId,
          JSON.stringify({
            fileName: uploadResult.fileName,
            folder: uploadResult.folderPath,
            checksum: uploadResult.checksum,
          }),
        ]
      );
    } catch (auditErr) {
      logger.warn('Audit log write skipped in Google Drive upload', 'GoogleDriveService');
    }

    return uploadResult;
  }
}
