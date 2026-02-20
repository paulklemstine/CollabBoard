export interface BoardMetadata {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  createdByGuest: boolean;
  createdAt: number;
  updatedAt: number;
  isPublic?: boolean;
  thumbnailUrl?: string;
}

export interface BoardObject {
  id: string;
  type: 'sticky' | 'shape' | 'frame' | 'sticker' | 'connector' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  createdBy: string;
  updatedAt: number;
  parentId?: string;
  aiLabel?: string;
  aiGroupId?: string;
}

export interface StickyNote extends BoardObject {
  type: 'sticky';
  text: string;
  color: string;
  textColor?: string;
  borderColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
}

export interface TextObject extends BoardObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  bgColor?: string;
  borderColor?: string;
}

export type ShapeType = 'rect' | 'circle' | 'line' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'octagon' | 'star' | 'arrow' | 'cross';

export interface Shape extends BoardObject {
  type: 'shape';
  shapeType: ShapeType;
  color: string;
  strokeColor?: string;
  borderColor?: string;
}

export interface Frame extends BoardObject {
  type: 'frame';
  title: string;
  /** When true, frame renders with no visible border or title bar — invisible grouping container */
  borderless?: boolean;
  /** Fill / background color */
  color?: string;
  /** Border stroke color */
  borderColor?: string;
  /** Title text color */
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

export interface Sticker extends BoardObject {
  type: 'sticker';
  /** Emoji character for classic stickers; empty when gifUrl is set */
  emoji: string;
  /** Optional GIF URL (e.g. from GIPHY); when set, sticker renders as animated image */
  gifUrl?: string;
  /** Search term for GIPHY; client auto-resolves to gifUrl on first render */
  gifSearchTerm?: string;
}

export type ConnectorLineType = 'solid' | 'dashed' | 'dotted';

export interface ConnectorStyle {
  lineType: ConnectorLineType;
  startArrow: boolean;
  endArrow: boolean;
  strokeWidth: number;
  color: string;
}

export interface Connector extends BoardObject {
  type: 'connector';
  fromId: string;
  toId: string;
  style: 'straight' | 'curved';
  /** Extended style options — absent on legacy connectors */
  lineType?: ConnectorLineType;
  startArrow?: boolean;
  endArrow?: boolean;
  strokeWidth?: number;
  color?: string;
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
