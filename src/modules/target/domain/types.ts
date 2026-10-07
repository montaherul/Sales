// Domain: Target & Working Days Models

export interface TerritoryBrandTargetItem {
  id: string;
  territoryId: string;
  territoryName?: string;
  brandId: string;
  targetQuantity: number;
  year: number;
  month: number;
}
