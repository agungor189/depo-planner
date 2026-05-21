import test from 'node:test';
import assert from 'node:assert/strict';
import { runImportPipeline } from './pipeline';

test('label printer package JSON import is normalized and validated', () => {
  const result = runImportPipeline({
    fileName: 'packages-export.json',
    text: JSON.stringify({
      schemaVersion: 'label-printer.packages.v1',
      packages: [
        {
          packageId: 'PKT-1',
          sku: 'AL-125-B',
          productName: '1 İnç 90° Dirsek',
          material: 'Alüminyum',
          dimensionsLabel: '36 x 25 x 25 cm',
          quantityPerPackage: '75',
        },
      ],
    }),
    now: '2026-05-21T00:00:00.000Z',
  });

  assert.equal(result.batch.validCount, 1);
  assert.equal(result.validPackages[0].packageId, 'PKT-1');
  assert.equal(result.validPackages[0].profile.boxWidthCm, 36);
});

test('duplicate package keys are reported', () => {
  const result = runImportPipeline({
    fileName: 'packages-export.json',
    text: JSON.stringify({
      schemaVersion: 'label-printer.packages.v1',
      packages: [
        { packageId: 'PKT-1', sku: 'AL-125-B', quantityPerPackage: '10' },
        { packageId: 'PKT-1', sku: 'AL-125-B', quantityPerPackage: '10' },
      ],
    }),
    now: '2026-05-21T00:00:00.000Z',
  });

  assert.equal(result.batch.duplicateCount, 1);
  assert.equal(result.rejectedRows.length, 1);
});
