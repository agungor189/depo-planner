import { PackageUnit, ProductCategory, ImportBatch, ImportRowStatus, ImportSourceType, WMS_SCHEMA_VERSION } from '../../domain/types';
import { detectDuplicatePackageKeys, validatePackageUnit, ValidationIssue } from '../../domain/validators/importValidation';

export interface ImportPipelineInput {
  fileName: string;
  text: string;
  now?: string;
}

export interface ImportPreviewRow {
  rowIndex: number;
  status: ImportRowStatus;
  raw: Record<string, unknown>;
  normalized?: PackageUnit;
  issues: ValidationIssue[];
}

export interface ImportPipelineResult {
  batch: ImportBatch;
  rows: ImportPreviewRow[];
  validPackages: PackageUnit[];
  rejectedRows: ImportPreviewRow[];
  sourceType: ImportSourceType;
}

const categoryTerms: Array<[ProductCategory, string[]]> = [
  ['Alüminyum', ['alüminyum', 'aluminyum', 'aluminum', 'al']],
  ['Döküm', ['döküm', 'dokum', 'dk']],
  ['Karbon Çelik', ['karbon', 'çelik', 'celik']],
  ['PPR', ['ppr']],
  ['Karışık', ['karışık', 'karisik', 'mixed']],
];

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeCategory(value: unknown): ProductCategory {
  const text = String(value || '').toLocaleLowerCase('tr-TR');
  const matched = categoryTerms.find(([, terms]) => terms.some((term) => text.includes(term)));
  return matched?.[0] || 'Diğer';
}

function looseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDimensions(value: unknown) {
  const numbers = String(value || '')
    .replace(',', '.')
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite) || [];

  return {
    boxWidthCm: Math.max(1, numbers[0] || 36),
    boxDepthCm: Math.max(1, numbers[1] || 25),
    boxHeightCm: Math.max(1, numbers[2] || 25),
  };
}

function normalizeSku(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '-');
}

function detectSourceType(fileName: string, text: string): ImportSourceType {
  const lowerName = fileName.toLocaleLowerCase('tr-TR');
  if (lowerName.endsWith('.xlsx')) return 'xlsx';
  if (lowerName.endsWith('.csv')) return 'csv';
  try {
    const parsed = JSON.parse(text);
    if (parsed?.schemaVersion === 'label-printer.packages.v1') return 'label-printer-json';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = lines[0]?.split(',').map((header) => header.trim()) || [];
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    return headers.reduce<Record<string, unknown>>((row, header, index) => {
      row[header] = cells[index]?.trim() || '';
      return row;
    }, {});
  });
}

function rawRows(input: ImportPipelineInput, sourceType: ImportSourceType): Record<string, unknown>[] {
  if (sourceType === 'label-printer-json') {
    const parsed = JSON.parse(input.text) as { packages?: Array<Record<string, unknown>> };
    return Array.isArray(parsed.packages) ? parsed.packages : [];
  }
  if (sourceType === 'csv') return parseCsv(input.text);
  return [];
}

function normalizeRow(row: Record<string, unknown>, rowIndex: number, batchId: string, now: string): PackageUnit {
  const sku = normalizeSku(row.sku || row.productCode || row.product_code);
  const packageId = String(row.packageId || row.package_id || '').trim();
  const dimensions = parseDimensions(row.dimensionsLabel || row.dimensions || row.boxDimensions);
  const quantityInsidePackage = Math.max(0, Math.floor(looseNumber(row.quantityPerPackage || row.quantityInsidePackage || row.qtyPerPackage, 0)));
  const packageKey = packageId || hashText([
    sku,
    row.productCode || row.supplierCode || '',
    row.lot || '',
    row.packageNo || row.packageIndex || rowIndex,
    quantityInsidePackage,
    row.dimensionsLabel || '',
  ].join('|')).slice(0, 24);

  return {
    packageId: packageId || `PKG-${packageKey.toUpperCase()}`,
    packageKey,
    sku,
    productName: String(row.productName || row.product_name || row.name || sku),
    supplierCode: String(row.supplierCode || row.productCode || row.product_code || sku),
    category: normalizeCategory(row.category || row.material || row.type),
    material: String(row.material || ''),
    type: String(row.type || ''),
    lot: String(row.lot || ''),
    packageNo: String(row.packageNo || row.package_no || ''),
    packageIndex: Math.max(1, Math.floor(looseNumber(row.packageIndex || row.labelIndex || row.packageNo, 1))),
    totalPackages: Math.max(1, Math.floor(looseNumber(row.totalPackages || row.total_packages, 1))),
    profile: {
      ...dimensions,
      weightKg: Math.max(0, looseNumber(row.boxWeight || row.productWeight || row.weightKg, 0)),
      quantityInsidePackage,
    },
    currentLocationCode: null,
    status: 'received',
    sourceImportBatchId: batchId,
    createdAt: now,
    updatedAt: now,
  };
}

export function runImportPipeline(input: ImportPipelineInput): ImportPipelineResult {
  const now = input.now || new Date().toISOString();
  const sourceType = detectSourceType(input.fileName, input.text);
  const sourceFileHash = hashText(input.text);
  const importBatchId = `IMP-${sourceFileHash.slice(0, 12)}`;
  const rows = rawRows(input, sourceType);

  const normalizedRows = rows.map((raw, rowIndex): ImportPreviewRow => {
    const normalized = normalizeRow(raw, rowIndex, importBatchId, now);
    const validation = validatePackageUnit(rowIndex, normalized);
    return {
      rowIndex,
      status: validation.valid ? 'valid' : 'error',
      raw,
      normalized,
      issues: validation.issues,
    };
  });

  const duplicateIssues = detectDuplicatePackageKeys(normalizedRows.flatMap((row) => row.normalized ? [row.normalized] : []));
  const duplicateByRow = new Map(duplicateIssues.map((issue) => [issue.rowIndex, issue]));
  const previewRows = normalizedRows.map((row) => {
    const duplicateIssue = duplicateByRow.get(row.rowIndex);
    if (!duplicateIssue) return row;
    return {
      ...row,
      status: 'duplicate' as const,
      issues: [...row.issues, duplicateIssue],
    };
  });

  const validPackages = previewRows
    .filter((row) => row.status === 'valid' || row.status === 'warning')
    .flatMap((row) => row.normalized ? [row.normalized] : []);

  const rejectedRows = previewRows.filter((row) => row.status === 'error' || row.status === 'duplicate');

  return {
    batch: {
      importBatchId,
      schemaVersion: WMS_SCHEMA_VERSION,
      sourceType,
      sourceFileName: input.fileName,
      sourceFileHash,
      rowCount: rows.length,
      validCount: validPackages.length,
      warningCount: previewRows.filter((row) => row.issues.some((issue) => issue.severity === 'warning')).length,
      errorCount: previewRows.filter((row) => row.status === 'error').length,
      duplicateCount: previewRows.filter((row) => row.status === 'duplicate').length,
      createdAt: now,
    },
    rows: previewRows,
    validPackages,
    rejectedRows,
    sourceType,
  };
}
