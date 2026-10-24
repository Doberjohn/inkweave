/**
 * The vote page's code, as one file: the page, and the first pair main.tsx's hold draws for it
 * (#915). The router imports both from here, since importing the queue apart from the page would
 * split it into a file of its own.
 */
export {VotePage} from './VotePage';
export {startFirstPair} from '../features/voting/hooks/usePairQueue';
