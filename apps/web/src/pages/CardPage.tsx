import {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useCardModal} from '../shared/contexts/CardModalContext';

/**
 * Legacy `/card/:cardId` route — preserved for deep links and bookmarks.
 *
 * Card detail is now a global modal (see `CardOverviewModal` mounted by `CardModalProvider`).
 * This route component opens the modal for the requested card and redirects the URL to `/`,
 * so a deep link lands on the home page with the modal layered on top.
 */
export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {openCardModal} = useCardModal();

  useEffect(() => {
    if (cardId) openCardModal(cardId);
    navigate('/', {replace: true});
  }, [cardId, openCardModal, navigate]);

  return null;
}

export default CardPage;
