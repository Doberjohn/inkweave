import {useContext} from 'react';
import {CardPreviewContext} from './CardPreviewContext';

export function useCardPreview() {
  const context = useContext(CardPreviewContext);
  if (!context) {
    throw new Error('useCardPreview must be used within CardPreviewProvider');
  }
  return context;
}
