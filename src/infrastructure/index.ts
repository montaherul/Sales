// Infrastructure Layer: Data Repositories, Database Queries & External Adapters
// Handles low-level persistence, stored procedures, and external services
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

// Repositories
export { userRepository, UserRepository } from '@/modules/identity/infrastructure/UserRepository';
export { roleRepository, RoleRepository } from '@/modules/identity/infrastructure/RoleRepository';
export { menuAccessRepository, MenuAccessRepository } from '@/modules/identity/infrastructure/MenuAccessRepository';

export { companyRepository, CompanyRepository } from '@/modules/organization/infrastructure/CompanyRepository';
export { hierarchyRepository, HierarchyRepository } from '@/modules/organization/infrastructure/HierarchyRepository';
export { masterDataRepository, MasterDataRepository } from '@/modules/organization/infrastructure/MasterDataRepository';

export { productRepository, ProductRepository } from '@/modules/product/infrastructure/ProductRepository';
export { targetRepository, TargetRepository } from '@/modules/target/infrastructure/TargetRepository';

export { dailySalesRepository, DailySalesRepository } from '@/modules/daily-sales/infrastructure/DailySalesRepository';
export { auditLogRepository, AuditLogRepository } from '@/modules/audit/infrastructure/AuditLogRepository';
export { reportingRepository, ReportingRepository } from '@/modules/reporting/infrastructure/ReportingRepository';

// External Adapters & Builders
export { GoogleDriveAdapter } from '@/infrastructure/google/GoogleDriveAdapter';
export { GoogleSheetsAdapter } from '@/infrastructure/google/GoogleSheetsAdapter';
export { WorkbookBuilder } from '@/modules/excel-export/application/WorkbookBuilder';
export { ImportValidationPipeline } from '@/modules/excel-import/domain/ImportValidationPipeline';
