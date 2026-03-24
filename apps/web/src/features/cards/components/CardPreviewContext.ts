import {createContext} from 'react';
import type {LorcanaCard} from '../types';

export interface CardPreviewState {
  card: LorcanaCard | null;
  position: {x: number; y: number};
  isTouchMode: boolean;
}

export interface CardPreviewContextValue {
  previewState: CardPreviewState;
  showPreview: (card: LorcanaCard, x: number, y: number, isTouchMode?: boolean) => void;
  updatePosition: (x: number, y: number) => void;
  hidePreview: () => void;
}

export const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);
