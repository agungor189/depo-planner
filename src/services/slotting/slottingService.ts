import { PackageUnit, SlotLocation } from '../../domain/types';

export interface SlottingScoreBreakdown {
  capacityScore: number;
  distanceScore: number;
  skuAffinityScore: number;
  weightScore: number;
  pickingScore: number;
  fragmentationScore: number;
  finalScore: number;
  reasons: string[];
}

export interface SlottingSuggestion {
  packageId: string;
  locationCode: string;
  score: SlottingScoreBreakdown;
  packageUnit: PackageUnit;
  location: SlotLocation;
}

export interface SlottingContext {
  locations: SlotLocation[];
  existingSkuLocations: Record<string, string[]>;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function capacityScore(location: SlotLocation): number {
  if (location.status !== 'active') return 0;
  if (location.currentOccupancy >= location.capacityPackageCount) return 0;
  const freeRatio = (location.capacityPackageCount - location.currentOccupancy) / Math.max(1, location.capacityPackageCount);
  return clampScore(65 + freeRatio * 35);
}

function weightScore(pkg: PackageUnit, location: SlotLocation): number {
  if (location.maxWeightKg <= 0) return 85;
  return pkg.profile.weightKg <= location.maxWeightKg ? 100 : 0;
}

function skuAffinityScore(pkg: PackageUnit, location: SlotLocation, existingSkuLocations: Record<string, string[]>): number {
  const existing = existingSkuLocations[pkg.sku] || [];
  if (existing.includes(location.locationCode)) return 100;
  if (existing.some((code) => code.startsWith(location.rackCode))) return 90;
  if (location.allowedSkuGroups.includes(pkg.category)) return 80;
  if (location.allowedSkuGroups.length === 0) return 65;
  return 25;
}

export function scoreLocationForPackage(pkg: PackageUnit, location: SlotLocation, context: SlottingContext): SlottingScoreBreakdown {
  const scores = {
    capacityScore: capacityScore(location),
    distanceScore: clampScore(100 - location.walkingDistanceScore),
    skuAffinityScore: skuAffinityScore(pkg, location, context.existingSkuLocations),
    weightScore: weightScore(pkg, location),
    pickingScore: clampScore(location.pickingPriority),
    fragmentationScore: location.currentOccupancy > 0 ? 90 : 75,
  };

  const finalScore = clampScore(
    scores.capacityScore * 0.28 +
    scores.distanceScore * 0.16 +
    scores.skuAffinityScore * 0.24 +
    scores.weightScore * 0.16 +
    scores.pickingScore * 0.1 +
    scores.fragmentationScore * 0.06,
  );

  const reasons = [
    scores.capacityScore > 0 ? 'kapasite uygun' : 'kapasite uygun değil',
    scores.skuAffinityScore >= 80 ? 'SKU/kategori yakınlığı güçlü' : 'SKU yakınlığı zayıf',
    scores.weightScore === 100 ? 'ağırlık limiti uygun' : 'ağırlık limiti aşılıyor',
    scores.distanceScore >= 70 ? 'yürüme mesafesi düşük' : 'yürüme mesafesi orta/yüksek',
  ];

  return { ...scores, finalScore, reasons };
}

export function suggestPutawayLocations(packages: PackageUnit[], context: SlottingContext): SlottingSuggestion[] {
  return packages.flatMap((packageUnit) => {
    const candidates = context.locations
      .filter((location) => location.status === 'active')
      .map((location) => ({
        packageId: packageUnit.packageId,
        locationCode: location.locationCode,
        score: scoreLocationForPackage(packageUnit, location, context),
        packageUnit,
        location,
      }))
      .filter((candidate) => candidate.score.capacityScore > 0 && candidate.score.weightScore > 0)
      .sort((a, b) => b.score.finalScore - a.score.finalScore);

    return candidates[0] ? [candidates[0]] : [];
  });
}
