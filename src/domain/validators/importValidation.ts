import { PackageUnit, ProductCategory } from '../types';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  rowIndex: number;
  field: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const knownCategories: ProductCategory[] = ['Alüminyum', 'Döküm', 'Karbon Çelik', 'PPR', 'Karışık', 'Diğer'];

export function validatePackageUnit(rowIndex: number, item: PackageUnit): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!item.packageId.trim()) {
    issues.push({
      rowIndex,
      field: 'packageId',
      severity: 'error',
      code: 'PACKAGE_ID_REQUIRED',
      message: 'Paket kimliği zorunlu.',
    });
  }

  if (!item.sku.trim()) {
    issues.push({
      rowIndex,
      field: 'sku',
      severity: 'error',
      code: 'SKU_REQUIRED',
      message: 'SKU zorunlu.',
    });
  }

  if (!item.productName.trim()) {
    issues.push({
      rowIndex,
      field: 'productName',
      severity: 'warning',
      code: 'PRODUCT_NAME_MISSING',
      message: 'Ürün adı eksik; paket SKU üzerinden takip edilecek.',
    });
  }

  if (!knownCategories.includes(item.category)) {
    issues.push({
      rowIndex,
      field: 'category',
      severity: 'warning',
      code: 'CATEGORY_UNKNOWN',
      message: 'Kategori tanınmadı; Diğer olarak ele alınmalı.',
    });
  }

  if (item.profile.quantityInsidePackage <= 0) {
    issues.push({
      rowIndex,
      field: 'quantityInsidePackage',
      severity: 'error',
      code: 'QTY_PER_PACKAGE_INVALID',
      message: 'Paket içi adet 0’dan büyük olmalı.',
    });
  }

  if (item.profile.boxWidthCm <= 0 || item.profile.boxDepthCm <= 0 || item.profile.boxHeightCm <= 0) {
    issues.push({
      rowIndex,
      field: 'boxDimensions',
      severity: 'error',
      code: 'BOX_DIMENSIONS_INVALID',
      message: 'Paket ölçüleri 0’dan büyük olmalı.',
    });
  }

  if (item.profile.weightKg < 0) {
    issues.push({
      rowIndex,
      field: 'weightKg',
      severity: 'error',
      code: 'WEIGHT_INVALID',
      message: 'Paket ağırlığı negatif olamaz.',
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}

export function detectDuplicatePackageKeys(items: PackageUnit[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  items.forEach((item, rowIndex) => {
    const existing = seen.get(item.packageKey);
    if (existing !== undefined) {
      issues.push({
        rowIndex,
        field: 'packageKey',
        severity: 'error',
        code: 'PACKAGE_DUPLICATE',
        message: `Aynı paket anahtarı daha önce ${existing + 1}. satırda var.`,
      });
      return;
    }
    seen.set(item.packageKey, rowIndex);
  });

  return issues;
}
