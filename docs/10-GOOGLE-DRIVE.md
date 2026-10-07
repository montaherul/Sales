# 10 - GOOGLE DRIVE INTEGRATION SPECIFICATION

## 1. Access Governance & Exclusivity

> **CRITICAL SECURITY RULE:**  
> Google Drive cloud upload is strictly restricted to the `SUPER_ADMIN` role.

- RSO, TSO, and CSR roles cannot trigger cloud uploads, list cloud drive contents, or configure Drive credentials.
- Any API endpoint handling Google Drive uploads must enforce `drive.upload` permission backed by server-side role verification.

---

## 2. Cloud Directory Hierarchy

Reports must be archived into an organized chronological folder structure:

```text
Afaz_Tobacco_Reports/
  └── {YYYY}/
        └── {MM}_{MonthName}/
              └── {YYYY-MM-DD}/
                    └── Daily sales and Closing Stock Information {Month} {Date} {Year}.xlsx
```

### Concrete Example:
- **Year:** `2026`
- **Month:** `10_October`
- **Day:** `2026-10-06`
- **Path:** `Afaz_Tobacco_Reports/2026/10_October/2026-10-06/`
- **Archived File:** `Daily sales and Closing Stock Information October 6 2026.xlsx`

The service must automatically create missing parent folders (`Afaz_Tobacco_Reports`, `2026`, `10_October`, `2026-10-06`) if they do not yet exist.

---

## 3. Upload & Archival Pipeline

```text
1. User requests Drive Upload (User must be SUPER_ADMIN)
   ↓
2. Generate Authoritative 34-Sheet XLSX Workbook
   ↓
3. Execute Pre-Export Validation Suite
   ↓
4. Calculate SHA-256 Checksum of the Generated Binary
   ↓
5. Query Google Drive API for Target Folder & Existing Filename
   ↓
6. Collision Check:
   - If identical checksum exists: Abort with "Identical report already archived".
   - If different version exists: Prompt Super Admin with Replace Confirmation.
   ↓
7. Upload Binary via Google Drive API v3 (multipart/resumable upload)
   ↓
8. Retrieve & Verify Google Drive File ID and Web View Link
   ↓
9. Record Metadata in PostgreSQL (`google_drive_files` table)
   ↓
10. Emit Audit Log Entry (`event_type = 'DRIVE_UPLOAD'`)
```

---

## 4. Technical Credentials & OAuth Scope

- **API Version:** Google Drive API v3 (`googleapis/drive/v3`)
- **OAuth Scope:** `https://www.googleapis.com/auth/drive.file`  
  *(Ensures the platform can only access files and folders it creates, minimizing security blast radius).*
- **Authentication Mode:**
  - Option A: Google Cloud Service Account with domain-wide delegation or folder sharing.
  - Option B: Super Admin OAuth2 Refresh Token stored securely in environment variables.
- **Forbidden:** Never expose Google Client Secrets or Service Account private keys to the client browser.

---

## 5. Metadata Schema (`google_drive_files`)

Every upload must commit an immutable entry into PostgreSQL:

```sql
INSERT INTO google_drive_files (
    file_name,
    drive_file_id,
    drive_folder_path,
    sha256_checksum,
    file_size,
    uploaded_by,
    report_date
) VALUES (
    'Daily sales and Closing Stock Information October 6 2026.xlsx',
    '1a2B3c4D5e6F7g8H9i0J...',
    'Afaz_Tobacco_Reports/2026/10_October/2026-10-06/',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    914420,
    auth.uid(),
    '2026-10-06'
);
```

---

## 6. Resilience & Retry Strategy

- **Transient Network Errors:** Exponential backoff (initial delay: 1s, max delay: 10s, 3 retries).
- **Large File Resumable Upload:** Files over 5MB must use Google Drive resumable upload session.
- **Fail Safe:** If upload succeeds but metadata write fails, the error is flagged, and the Drive File ID is logged to prevent orphaned cloud assets.
