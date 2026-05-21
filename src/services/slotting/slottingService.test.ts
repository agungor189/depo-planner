import test from 'node:test';
import assert from 'node:assert/strict';
import { PackageUnit, SlotLocation } from '../../domain/types';
import { scoreLocationForPackage, suggestPutawayLocations } from './slottingService';

const pkg: PackageUnit = {
  packageId: 'PKT-1',
  packageKey: 'PKT-1',
  sku: 'AL-125-B',
  productName: 'Modüler bağlantı elemanı',
  supplierCode: 'AL-125-B',
  category: 'Alüminyum',
  profile: { boxWidthCm: 36, boxDepthCm: 25, boxHeightCm: 25, weightKg: 5, quantityInsidePackage: 75 },
  currentLocationCode: null,
  status: 'received',
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

const location: SlotLocation = {
  locationCode: 'A1-B1-ON-K1-P1',
  warehouseId: 'WH-1',
  zoneCode: 'AL',
  aisleCode: 'A',
  rackCode: 'A1',
  bayCode: 'B1',
  face: 'front',
  levelNumber: 1,
  slotNumber: 1,
  capacityPackageCount: 2,
  maxWeightKg: 20,
  allowedSkuGroups: ['Alüminyum'],
  currentOccupancy: 0,
  status: 'active',
  coordinates: { xM: 1, yM: 0, zM: 1 },
  walkingDistanceScore: 15,
  pickingPriority: 90,
};

test('slotting scoring rewards capacity, category and weight fit', () => {
  const score = scoreLocationForPackage(pkg, location, { locations: [location], existingSkuLocations: {} });
  assert.ok(score.finalScore >= 80);
  assert.ok(score.reasons.some((reason) => reason.includes('kapasite')));
});

test('slotting suggestion skips blocked locations', () => {
  const blocked = { ...location, locationCode: 'A1-B1-ON-K1-P2', status: 'blocked' as const };
  const suggestions = suggestPutawayLocations([pkg], { locations: [blocked, location], existingSkuLocations: {} });
  assert.equal(suggestions[0].locationCode, location.locationCode);
});
