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
    description: 'Watch the cursor open the Shapes drawer, pick Sticky to create one, then select it and reopen the drawer to change its colors.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    animationKey: 'sticky',
  },
  {
    id: 'create-text',
    title: 'Text Objects',
    description: 'The cursor opens the Text options, sets Bold and Serif, then clicks the Text button to create. After selecting the text, it reopens options to change styles live.',
    targetSelector: '[data-tutorial-id="toolbar"]',
    animationKey: 'text',
  },
  {
    id: 'create-shape',
    title: 'Shapes',
    description: 'Watch the cursor open the Shapes drawer and pick different shapes to create them. Then it selects a shape and reopens the drawer to change its colors.',
    targetSelector: '[data-tutorial-id="shape-tool"]',
    animationKey: 'shape',
  },
  {
    id: 'create-sticker',
    title: 'Stickers & GIFs',
    description: 'A sticker is placed from the toolbar, then watch it cycle through emojis, wobble, and resize!',
    targetSelector: '[data-tutorial-id="toolbar"]',
    animationKey: 'sticker',
  },
  {
    id: 'create-connector',
    title: 'Connectors',
    description: 'Watch the cursor create two objects from the Shapes drawer, then open the Link options to set Curved and Arrow styles before connecting them.',
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
    id: 'cam-chat',
    title: 'Cam & Chat',
    description: 'Use the Cam button to share your webcam, and Chat to message your team \u2014 all without leaving the board!',
    targetSelector: '[data-tutorial-id="toolbar"]',
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
