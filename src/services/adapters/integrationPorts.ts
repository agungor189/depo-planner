import { OrderAllocation, PackageUnit, Product, Reservation } from '../../domain/types';

export interface ProductMasterProvider {
  findBySku(sku: string): Promise<Product | null>;
  upsertProducts(products: Product[]): Promise<void>;
}

export interface LabelPrinterExportAdapter {
  parsePackagesExport(text: string, fileName: string): Promise<PackageUnit[]>;
  buildPackageLabelPayload(pkg: PackageUnit): string;
}

export interface WmsInventoryAdapter {
  listPackages(): Promise<PackageUnit[]>;
  commitPackageMove(packageId: string, toLocationCode: string): Promise<void>;
}

export interface OrderReservationAdapter {
  reserveSku(orderId: string, sku: string, quantity: number): Promise<Reservation>;
  allocateOrder(orderId: string): Promise<OrderAllocation>;
}
