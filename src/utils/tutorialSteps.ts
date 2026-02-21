export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector using data-tutorial-id to find the spotlight target. Null = no spotlight. */
  targetSelector: string | null;
  /** Key into the animation registry. Undefined = info-only step with no canvas animation. */
  animationKey?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FlowSpace!',
    description: 'Let\'s take a quick tour of your collaboration board. We\'ll create some objects so you can see what\'s possible.',
    targetSelector: null,
  },
  {
    id: 'toolbar',
    title: 'Your Toolbar',
    description: 'This is your main toolbar. It has everything you need: text, shapes, stickers, connectors, chat, and AI.',
    targetSelector: '[data-tutorial-id="toolbar"]',
  },
  {
    id: 'create-sticky',
    title: 'Sticky Notes',
    description: 'Watch the canvas! We\'re cycling through colors, changing text, and toggling bold. Click to edit, drag to move.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    animationKey: 'sticky',
  },
  {
    id: 'create-text',
    title: 'Text Objects',
    description: 'Rich text with custom fonts, sizes, alignment, and colors. Great for titles, labels, and annotations.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    animationKey: 'text',
  },
  {
    id: 'create-shape',
    title: 'Shapes',
    description: 'Watch it morph! Stars, circles, diamonds, hexagons, triangles — 11 shape types with customizable fills.',
    targetSelector: '[data-tutorial-id="shape-tool"]',
    animationKey: 'shape',
  },
  {
    id: 'create-frame',
    title: 'Frames',
    description: 'Frames group objects together. Watch as we create children inside and restyle the frame colors.',
    targetSelector: '[data-tutorial-id="shape-tool"]',
    animationKey: 'frame',
  },
  {
    id: 'create-sticker',
    title: 'Stickers & GIFs',
    description: 'Emoji stickers with wobble! Watch it cycle through emojis, rotate, and resize.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    animationKey: 'sticker',
  },
  {
    id: 'create-connector',
    title: 'Connectors',
    description: 'Linking objects! Watch the connector toggle straight/curved, line styles, arrows, and colors.',
    targetSelector: '[data-tutorial-id="connector-tool"]',
    animationKey: 'connector',
  },
  {
    id: 'ai-assistant',
    title: 'Flow AI',
    description: 'The real magic! Watch AI-style staggered creation. Ask it to "Create a project roadmap" or "Brainstorm marketing ideas".',
    targetSelector: '[data-tutorial-id="ai-button"]',
    animationKey: 'ai-mock',
  },
  {
    id: 'collaboration',
    title: 'Real-time Collaboration',
    description: 'Share your board link and collaborate live! You\'ll see other users\' cursors, edits, and presence in real time.',
    targetSelector: '[data-tutorial-id="presence-panel"]',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+C/V copy/paste, Ctrl+D duplicate, Delete to remove, Scroll to zoom, L to toggle AI labels.',
    targetSelector: '[data-tutorial-id="undo-redo"]',
  },
  {
    id: 'complete',
    title: 'You\'re all set!',
    description: 'That\'s the tour! We\'ll clean up these demo objects now. Click "?" in the top bar anytime to see shortcuts or retake the tour.',
    targetSelector: null,
  },
];
