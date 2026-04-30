import { useCallback, useState } from 'react';
import { Skia, type SkPath } from '@shopify/react-native-skia';
import { useCameraStore } from '../store/cameraStore';

interface ActivePath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

interface CompletedPath {
  path: SkPath;
  color: string;
  strokeWidth: number;
}

export function useDrawing() {
  const drawingColor = useCameraStore((s) => s.drawingColor);
  const drawingStrokeWidth = useCameraStore((s) => s.drawingStrokeWidth);
  const [completedPaths, setCompletedPaths] = useState<CompletedPath[]>([]);
  const [activePath, setActivePath] = useState<ActivePath | null>(null);
  const [undoStack, setUndoStack] = useState<CompletedPath[][]>([]);

  const startPath = useCallback(
    (x: number, y: number) => {
      const path = Skia.Path.Make();
      path.moveTo(x, y);
      setActivePath({ path, color: drawingColor, strokeWidth: drawingStrokeWidth });
    },
    [drawingColor, drawingStrokeWidth]
  );

  const addPoint = useCallback(
    (x: number, y: number) => {
      if (!activePath) return;
      activePath.path.lineTo(x, y);
      setActivePath({ ...activePath });
    },
    [activePath]
  );

  const endPath = useCallback(() => {
    if (!activePath) return;
    setUndoStack((prev) => [...prev, completedPaths]);
    setCompletedPaths((prev) => [
      ...prev,
      {
        path: activePath.path,
        color: activePath.color,
        strokeWidth: activePath.strokeWidth,
      },
    ]);
    setActivePath(null);
  }, [activePath, completedPaths]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setCompletedPaths(prev);
    setUndoStack((stack) => stack.slice(0, -1));
  }, [undoStack]);

  const clear = useCallback(() => {
    setCompletedPaths([]);
    setActivePath(null);
    setUndoStack([]);
  }, []);

  return {
    completedPaths,
    activePath,
    startPath,
    addPoint,
    endPath,
    undo: handleUndo,
    clear,
    canUndo: undoStack.length > 0,
  };
}
