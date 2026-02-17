export interface BoardObject {
  id: string;
  type: 'sticky' | 'shape' | 'frame' | 'sticker' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  createdBy: string;
  updatedAt: number;
}

export interface StickyNote extends BoardObject {
  type: 'sticky';
  text: string;
  color: string;
}

export type ShapeType = 'rect' | 'circle' | 'line';

export interface Shape extends BoardObject {
  type: 'shape';
  shapeType: ShapeType;
  color: string;
}

export interface Frame extends BoardObject {
  type: 'frame';
  title: string;
}

export interface Sticker extends BoardObject {
  type: 'sticker';
  emoji: string;
}

export interface Connector extends BoardObject {
  type: 'connector';
  fromId: string;
  toId: string;
  style: 'straight' | 'curved';
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  name: string;
  color: string;
  timestamp: number;
}

export interface PresenceUser {
  uid: string;
  displayName: string;
  email: string;
  color: string;
  online: boolean;
  lastSeen: number;
}
