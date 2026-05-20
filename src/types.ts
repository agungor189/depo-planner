export type ObjectType = 'rack' | 'column' | 'packing' | 'path';

export interface BaseObject {
  id: string;
  type: ObjectType;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
}

export interface Rack extends BaseObject {
  type: 'rack';
  code: string;
  shelves: number;
  binsPerShelf: number;
  color?: string;
}

export interface Column extends BaseObject {
  type: 'column';
}

export interface PackingArea extends BaseObject {
  type: 'packing';
}

export interface Path extends BaseObject {
  type: 'path';
}

export type WarehouseObject = Rack | Column | PackingArea | Path;

export type WarehouseObjectNoId = 
  | Omit<Rack, 'id'>
  | Omit<Column, 'id'>
  | Omit<PackingArea, 'id'>
  | Omit<Path, 'id'>;

export interface WarehouseConfig {
  width: number;
  length: number;
  height: number;
}
