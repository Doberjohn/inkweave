/**
 * The card utilities every web page needs, published as `inkweave-synergy-engine/card` (#640).
 *
 * The root entry bundles into a single module, and a bundler can't split one module across
 * chunks, so importing anything from the root brings the whole rule set along. These three have
 * no runtime dependencies, so importing them from here keeps the rules out of a page's JavaScript.
 * Everything else stays on the root, which scripts such as precompute rely on.
 */
export {isCoreSet} from './constants';
export {cardPath} from './utils/cardSlug';
export {transformCard} from './utils/cardTransformer';
