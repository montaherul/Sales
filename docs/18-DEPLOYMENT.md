# 18 - DEPLOYMENT & ENVIRONMENT CONFIGURATION

## 1. Hosting Architecture

- **Web Application & API:** Next.js deployed on Vercel or Dockerized Node.js runtime.
- **Database:** Managed Supabase PostgreSQL with automated daily backups.
- **Cloud Storage & APIs:** Google Cloud Platform (Google Drive API v3, Google Sheets API v4, Google OAuth 2.0).

---

## 2. Environment Variables Specification

Create `.env.local` for local development and configure production environment variables in your deployment dashboard:

```ini
# ==========================================
# SUPABASE CONFIGURATION
# ==========================================
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres"

# ==========================================
# GOOGLE OAUTH & CLOUD API CREDENTIALS
# ==========================================
GOOGLE_CLIENT_ID="1234567890-abcdef.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxx"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ==========================================
# GOOGLE DRIVE & SERVICE ACCOUNT (SUPER ADMIN)
# ==========================================
GOOGLE_SERVICE_ACCOUNT_EMAIL="afaz-drive-sync@your-project.iam.gserviceaccount.com"
# Base64 encoded private key or formatted PEM string:
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_NAME="Afaz_Tobacco_Reports"

# ==========================================
# APPLICATION DEFAULTS
# ==========================================
DEFAULT_WORKING_DAYS="26"
MAX_UPLOAD_SIZE_MB="25"
```

---

## 3. Deployment Pre-Flight Checks

Before deploying to production:
1. Ensure all database migrations have run against Supabase.
2. Confirm the initial `SUPER_ADMIN` user is provisioned.
3. Validate that the Google Service Account has `Editor` permissions on the `Afaz_Tobacco_Reports` root Drive folder.
4. Run `npm run test` and `npm run build` to confirm zero compilation or typing errors.
5. Verify health check endpoint at `/api/health`.
