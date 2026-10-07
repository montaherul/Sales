// Domain: Organizational Hierarchy Models
// Dynamic 8-level hierarchy: Company -> Division -> Wing -> Region -> Territory -> Route -> Outlet -> CSR

export interface CompanyEntity {
  id: string;
  name: string;
  code: string;
}

export interface TerritoryEntity {
  id: string;
  name: string;
  regionId: string;
  regionName?: string;
  sortOrder: number;
}
