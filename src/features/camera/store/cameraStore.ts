import { create } from 'zustand';

export type CameraFacing = 'back' | 'front';
export type CameraFlash = 'off' | 'on' | 'auto' | 'torch';
export type CaptureState = 'idle' | 'captured' | 'editing' | 'sending';

interface DrawingPath {
  path: string;
  color: string;
  strokeWidth: number;
}

export interface DirectRecipient {
  id: string;
  displayName: string;
}

interface CameraState {
  facing: CameraFacing;
  flash: CameraFlash;
  zoom: number;
  captureState: CaptureState;
  capturedUri: string | null;
  drawingMode: boolean;
  drawingColor: string;
  drawingStrokeWidth: number;
  paths: DrawingPath[];
  undoStack: DrawingPath[][];
 
  directRecipient: DirectRecipient | null;
}

interface CameraActions {
  toggleFacing: () => void;
  toggleFlash: () => void;
  setZoom: (zoom: number) => void;
  setCaptureState: (state: CaptureState) => void;
  setCapturedUri: (uri: string | null) => void;
  setDrawingMode: (enabled: boolean) => void;
  setDrawingColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;
  addPath: (path: DrawingPath) => void;
  undo: () => void;
  clearDrawing: () => void;
  setDirectRecipient: (r: DirectRecipient | null) => void;
  reset: () => void;
}

export const useCameraStore = create<CameraState & CameraActions>()((set, get) => ({
  facing: 'back',
  flash: 'off',
  zoom: 0,
  captureState: 'idle',
  capturedUri: null,
  drawingMode: false,
  drawingColor: '#FFFC00',
  drawingStrokeWidth: 4,
  paths: [],
  undoStack: [],
  directRecipient: null,

  toggleFacing: () =>
    set((s) => ({ facing: s.facing === 'back' ? 'front' : 'back' })),

  toggleFlash: () =>
    set((s) => ({ flash: s.flash === 'off' ? 'on' : 'off' })),

  setZoom: (zoom) => set({ zoom }),
  setCaptureState: (captureState) => set({ captureState }),
  setCapturedUri: (capturedUri) => set({ capturedUri }),
  setDrawingMode: (drawingMode) => set({ drawingMode }),
  setDrawingColor: (drawingColor) => set({ drawingColor }),
  setDrawingStrokeWidth: (drawingStrokeWidth) => set({ drawingStrokeWidth }),

  addPath: (path) =>
    set((s) => ({
      paths: [...s.paths, path],
      undoStack: [...s.undoStack, s.paths],
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const prevPaths = undoStack[undoStack.length - 1];
    set({ paths: prevPaths, undoStack: undoStack.slice(0, -1) });
  },

  clearDrawing: () => set({ paths: [], undoStack: [] }),

  setDirectRecipient: (directRecipient) => set({ directRecipient }),

  reset: () =>
    set({
      captureState: 'idle',
      capturedUri: null,
      drawingMode: false,
      paths: [],
      undoStack: [],
      directRecipient: null,
    }),
}));
