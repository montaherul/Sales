// Application: Google Drive Use Cases
// Super Admin cloud archival with SHA-256 checksum, versioning, and audit logging
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { googleDriveAdapter, DriveUploadResult } from '@/infrastructure/google/GoogleDriveAdapter';
import { ExcelExportService } from '@/modules/excel-export';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError } from '@/shared/errors';
import { AuditService } from '@/modules/audit';

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
      companyId: dto.user.companyId || null,
    });

    // 4. Centralized Audit Log
    await AuditService.logEvent({
      userId: dto.user.id,
      companyId: dto.user.companyId || null,
      eventType: AUDIT_ACTIONS.GOOGLE_UPLOAD,
      entityName: 'google_drive_files',
      entityId: uploadResult.fileId,
      newValues: {
        fileName: uploadResult.fileName,
        folder: uploadResult.folderPath,
        checksum: uploadResult.checksum,
      },
    });

    return uploadResult;
  }
}
