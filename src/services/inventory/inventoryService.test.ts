import test from 'node:test';
import assert from 'node:assert/strict';
import { PackageUnit } from '../../domain/types';
import { commitPackageMove, InventoryState } from './inventoryService';

const packageUnit: PackageUnit = {
  packageId: 'PKT-1',
  packageKey: 'PKT-1',
  sku: 'AL-125-B',
  productName: 'Boru bağlantı elemanı',
  supplierCode: 'AL-125-B',
  category: 'Alüminyum',
  profile: { boxWidthCm: 36, boxDepthCm: 25, boxHeightCm: 25, weightKg: 4, quantityInsidePackage: 75 },
  currentLocationCode: null,
  status: 'received',
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

test('package move creates stock movement and audit log atomically', () => {
  const state: InventoryState = {
    packages: [packageUnit],
    stockUnits: [],
    movements: [],
    auditLogs: [],
  };

  const result = commitPackageMove(state, {
    packageId: 'PKT-1',
    toLocationCode: 'A1-K1-P1',
    actorId: 'USR-1',
    now: '2026-05-21T01:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.packages[0].currentLocationCode, 'A1-K1-P1');
  assert.equal(result.state.movements.length, 1);
  assert.equal(result.state.auditLogs.length, 1);
});
