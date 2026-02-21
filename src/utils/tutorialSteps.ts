export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector using data-tutorial-id to find the spotlight target. Null = center tooltip only. */
  targetSelector: string | null;
  tooltipPosition: 'top' | 'bottom' | 'left' | 'right';
  /** Action to auto-execute when entering this step */
  action: 'none' | 'create-sticky' | 'create-shape' | 'create-connector' | 'open-ai' | 'close-ai';
  /** If set, auto-advance to next step after this many ms */
  autoAdvanceMs: number | null;
  /** If true, wait for user to click Next before advancing */
  waitForUser: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FlowSpace!',
    description: 'This quick tour will show you how to create, connect, and collaborate on your board. Ready?',
    targetSelector: null,
    tooltipPosition: 'bottom',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'toolbar',
    title: 'Your Toolbar',
    description: 'This is your main toolbar. It has everything you need: text, shapes, stickers, connectors, and AI.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    tooltipPosition: 'top',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'create-sticky',
    title: 'Sticky Notes',
    description: 'We just created a sticky note for you! Sticky notes are perfect for quick ideas and brainstorming.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    tooltipPosition: 'top',
    action: 'create-sticky',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'create-shape',
    title: 'Shapes & Frames',
    description: 'And here\'s a shape! Use the Shapes menu to add circles, rectangles, stars, frames, and more.',
    targetSelector: '[data-tutorial-id="shape-tool"]',
    tooltipPosition: 'top',
    action: 'create-shape',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'create-connector',
    title: 'Connect Objects',
    description: 'We connected the sticky and the shape! Use the Link tool to draw lines between any objects.',
    targetSelector: '[data-tutorial-id="connector-tool"]',
    tooltipPosition: 'top',
    action: 'create-connector',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'interact',
    title: 'Drag, Resize & Rotate',
    description: 'Click any object to select it. Then drag to move, pull corners to resize, or use the rotation handle.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    tooltipPosition: 'top',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'ai-assistant',
    title: 'Flow AI',
    description: 'Ask AI to generate entire board layouts, brainstorm ideas, or organize your notes. Try it!',
    targetSelector: '[data-tutorial-id="ai-button"]',
    tooltipPosition: 'top',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'collaboration',
    title: 'Real-time Collaboration',
    description: 'Share your board link and collaborate live! You\'ll see other users\' cursors and changes in real time.',
    targetSelector: '[data-tutorial-id="presence-panel"]',
    tooltipPosition: 'left',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Speed up your workflow: Ctrl+Z to undo, Ctrl+C/V to copy/paste, Delete to remove, Scroll to zoom.',
    targetSelector: '[data-tutorial-id="undo-redo"]',
    tooltipPosition: 'top',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
  {
    id: 'complete',
    title: 'You\'re all set!',
    description: 'That\'s the basics! Would you like to keep the tutorial objects on your board or clean them up?',
    targetSelector: null,
    tooltipPosition: 'bottom',
    action: 'none',
    autoAdvanceMs: null,
    waitForUser: true,
  },
];
