export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector using data-tutorial-id to find the spotlight target. Null = no spotlight. */
  targetSelector: string | null;
  /** Action to auto-execute when entering this step */
  action: 'none' | 'create-sticky' | 'create-text' | 'create-shape' | 'create-frame' | 'create-sticker' | 'create-connector';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FlowSpace!',
    description: 'Let\'s take a quick tour of your collaboration board. We\'ll create some objects so you can see what\'s possible.',
    targetSelector: null,
    action: 'none',
  },
  {
    id: 'toolbar',
    title: 'Your Toolbar',
    description: 'This is your main toolbar. It has everything you need: text, shapes, stickers, connectors, chat, and AI.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    action: 'none',
  },
  {
    id: 'create-sticky',
    title: 'Sticky Notes',
    description: 'Here\'s a sticky note! Perfect for quick ideas and brainstorming. Click to edit, drag to move, and pull corners to resize.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    action: 'create-sticky',
  },
  {
    id: 'create-text',
    title: 'Text Objects',
    description: 'Rich text with custom fonts, sizes, and colors. Great for titles, labels, and annotations on your board.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    action: 'create-text',
  },
  {
    id: 'create-shape',
    title: 'Shapes',
    description: 'Circles, rectangles, stars, diamonds, arrows, and more. Use the Shapes menu to pick from 12 different shape types.',
    targetSelector: '[data-tutorial-id="shape-tool"]',
    action: 'create-shape',
  },
  {
    id: 'create-frame',
    title: 'Frames',
    description: 'Frames group objects together. Drag a frame and everything inside moves with it. Great for organizing sections of your board.',
    targetSelector: '[data-tutorial-id="shape-tool"]',
    action: 'create-frame',
  },
  {
    id: 'create-sticker',
    title: 'Stickers & GIFs',
    description: 'Add emoji stickers or search for animated GIFs to make your board expressive and fun!',
    targetSelector: '[data-tutorial-id="toolbar"]',
    action: 'create-sticker',
  },
  {
    id: 'create-connector',
    title: 'Connectors',
    description: 'We just linked two objects with a connector! Use the Link tool to draw straight or curved lines between any objects.',
    targetSelector: '[data-tutorial-id="connector-tool"]',
    action: 'create-connector',
  },
  {
    id: 'ai-assistant',
    title: 'Flow AI',
    description: 'The real magic! Ask AI to generate entire layouts: "Create a project roadmap", "Brainstorm marketing ideas", or "Organize these notes into categories".',
    targetSelector: '[data-tutorial-id="ai-button"]',
    action: 'none',
  },
  {
    id: 'collaboration',
    title: 'Real-time Collaboration',
    description: 'Share your board link and collaborate live! You\'ll see other users\' cursors, edits, and presence in real time.',
    targetSelector: '[data-tutorial-id="presence-panel"]',
    action: 'none',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+C/V copy/paste, Ctrl+D duplicate, Delete to remove, Scroll to zoom, L to toggle AI labels.',
    targetSelector: '[data-tutorial-id="undo-redo"]',
    action: 'none',
  },
  {
    id: 'complete',
    title: 'You\'re all set!',
    description: 'That\'s the tour! We\'ll clean up these demo objects now. Click "?" in the top bar anytime to see shortcuts or retake the tour.',
    targetSelector: null,
    action: 'none',
  },
];
