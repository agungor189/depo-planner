import { LocationFace } from './types';

export const LOCATION_CODE_VERSION = 'dsdst.location.v1' as const;

export type LocationCodeStyle = 'compact' | 'extended';

export interface LocationCodeParts {
  rackCode: string;
  bayCode?: string;
  face?: LocationFace;
  levelNumber: number;
  slotNumber: number;
}

export interface ParsedLocationCode {
  ok: true;
  version: typeof LOCATION_CODE_VERSION;
  style: LocationCodeStyle;
  parts: LocationCodeParts;
}

export interface LocationCodeParseError {
  ok: false;
  error: string;
}

export type LocationCodeParseResult = ParsedLocationCode | LocationCodeParseError;

const faceAliases: Record<string, LocationFace> = {
  ON: 'front',
  FRONT: 'front',
  FR: 'front',
  ARKA: 'back',
  BACK: 'back',
  BK: 'back',
};

function normalizeRackCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeBayCode(value?: string): string | undefined {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned || undefined;
}

function faceToken(face: LocationFace, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') return face === 'front' ? 'FRONT' : 'BACK';
  return face === 'front' ? 'ON' : 'ARKA';
}

export function formatLocationCode(
  parts: LocationCodeParts,
  style: LocationCodeStyle = 'compact',
  language: 'tr' | 'en' = 'tr',
): string {
  const rackCode = normalizeRackCode(parts.rackCode);
  const levelNumber = Math.max(1, Math.floor(Number(parts.levelNumber) || 1));
  const slotNumber = Math.max(1, Math.floor(Number(parts.slotNumber) || 1));
  const bayCode = normalizeBayCode(parts.bayCode);

  if (style === 'extended') {
    const face = parts.face || 'front';
    const levelPrefix = language === 'en' ? 'L' : 'K';
    const slotPrefix = language === 'en' ? 'S' : 'P';
    return [rackCode, bayCode || 'B1', faceToken(face, language), `${levelPrefix}${levelNumber}`, `${slotPrefix}${slotNumber}`].join('-');
  }

  return `${rackCode}-K${levelNumber}-P${slotNumber}`;
}

export function parseLocationCode(input: string): LocationCodeParseResult {
  const value = String(input || '').trim().toUpperCase();
  const compact = value.match(/^([A-Z0-9]+)-K(\d+)-P(\d+)$/);
  if (compact) {
    return {
      ok: true,
      version: LOCATION_CODE_VERSION,
      style: 'compact',
      parts: {
        rackCode: normalizeRackCode(compact[1]),
        levelNumber: Number(compact[2]),
        slotNumber: Number(compact[3]),
      },
    };
  }

  const extended = value.match(/^([A-Z0-9]+)-([A-Z0-9]+)-([A-Z]+)-(?:K|L)(\d+)-(?:P|S)(\d+)$/);
  if (extended) {
    const face = faceAliases[extended[3]];
    if (!face) return { ok: false, error: `Bilinmeyen lokasyon yüzü: ${extended[3]}` };

    return {
      ok: true,
      version: LOCATION_CODE_VERSION,
      style: 'extended',
      parts: {
        rackCode: normalizeRackCode(extended[1]),
        bayCode: normalizeBayCode(extended[2]),
        face,
        levelNumber: Number(extended[4]),
        slotNumber: Number(extended[5]),
      },
    };
  }

  return { ok: false, error: `Lokasyon kodu parse edilemedi: ${input}` };
}

export function isLocationCode(value: string): boolean {
  return parseLocationCode(value).ok;
}
