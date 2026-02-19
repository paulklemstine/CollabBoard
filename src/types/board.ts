export interface BoardMetadata {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  createdByGuest: boolean;
  createdAt: number;
  updatedAt: number;
  isPublic?: boolean;
}

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
  parentId?: string;
}

export interface StickyNote extends BoardObject {
  type: 'sticky';
  text: string;
  color: string;
}

export type ShapeType = 'rect' | 'circle' | 'line' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'octagon' | 'star' | 'arrow' | 'cross';

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

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  objectsCreated?: string[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  color: string;
  text: string;
  timestamp: number;
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  name: string;
  color: string;
  timestamp: number;
  /** Peer's viewport transform — used to replicate their view */
  viewportX?: number;
  viewportY?: number;
  viewportScale?: number;
}

export interface PresenceUser {
  uid: string;
  displayName: string;
  email: string;
  color: string;
  online: boolean;
  lastSeen: number;
}
