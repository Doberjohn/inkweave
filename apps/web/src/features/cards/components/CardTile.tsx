import {
  CardTile as TileOfCard,
  type CardTileProps as TileOfCardProps,
} from 'inkweave-ui/lorcana/CardTile';
import {smallImageUrl} from '../loader';
import {preloadCardOverviewModal} from '../../../shared/contexts/cardOverviewModalLoader';

interface CardTileProps extends Omit<TileOfCardProps, 'artUrl' | 'onIntent'> {
  /** Use the smaller grid-optimized image (191×266) instead of full-size (337×470). */
  useSmallImage?: boolean;
}

/**
 * inkweave-ui's CardTile with the app's two seams filled in (#980): the small grid art where
 * the grid asks for it, and the card modal's chunk warmed as the visitor heads for a link tile
 * (#640), so every link tile warms it and none can forget to.
 */
export function CardTile({useSmallImage, ...props}: CardTileProps) {
  return (
    <TileOfCard
      {...props}
      artUrl={useSmallImage ? smallImageUrl : undefined}
      onIntent={preloadCardOverviewModal}
    />
  );
}
