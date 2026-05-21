import { BarcodePayload, PackageUnit } from '../../domain/types';
import { parseLocationCode } from '../../domain/locationCode';

export function checksumPayload(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash + value.charCodeAt(index) * (index + 1)) % 100000;
  }
  return String(hash).padStart(5, '0');
}

export function buildPackageQrPayload(pkg: PackageUnit): BarcodePayload {
  const payload = {
    version: 'wms.package.v1' as const,
    packageId: pkg.packageId,
    sku: pkg.sku,
    supplierCode: pkg.supplierCode,
    qtyPerPackage: pkg.profile.quantityInsidePackage,
    packageNo: pkg.packageNo,
    lot: pkg.lot,
    productName: pkg.productName,
    createdAt: pkg.createdAt,
  };
  return {
    ...payload,
    checksum: checksumPayload(JSON.stringify(payload)),
  };
}

export function buildLocationQrPayload(locationCode: string, createdAt: string): BarcodePayload {
  const parsed = parseLocationCode(locationCode);
  if (parsed.ok === false) {
    throw new Error(parsed.error);
  }
  const payload = {
    version: 'wms.location.v1' as const,
    locationCode,
    createdAt,
  };
  return {
    ...payload,
    checksum: checksumPayload(JSON.stringify(payload)),
  };
}

export function serializeQrPayload(payload: BarcodePayload): string {
  if (payload.version === 'wms.location.v1') {
    return `DSDST|LOC|${payload.locationCode}|V|1|CHK|${payload.checksum}`;
  }
  return [
    'DSDST',
    'PKG',
    payload.packageId,
    'SKU',
    payload.sku,
    'QTY',
    payload.qtyPerPackage,
    'LOT',
    payload.lot || '',
    'CHK',
    payload.checksum,
  ].join('|');
}
