// Grandfather ledger for the inkweave design-token rules (#508).
//
// THIS LEDGER ONLY SHRINKS. A listed file existed before enforcement and keeps
// its violations silently — new files and clean files are held to the rules.
// When you touch a listed file, converge it and REMOVE its entry; never add
// entries (a new entry means new drift, which is exactly what the rules block).
// The value-grep gate (scripts/check-design-tokens.mjs) still counts listed
// files, so their violation counts cannot silently INCREASE either.
//
// Seeded 2026-07-22 from the enforcement-day lint run (counts in comments).
export const KNOWN_OFFENDERS = {
  // 72 files, 229 violations at seeding
  'no-raw-hex-colors': [
    'apps/web/src/features/cards/components/CardDetailSkeleton.stories.tsx', // x1
    'apps/web/src/features/playstyles/PlaystyleFanTile.stories.tsx', // x2
    'apps/web/src/features/playstyles/PlaystyleFanTile.tsx', // x2
    'apps/web/src/features/playstyles/PlaystyleSection.stories.tsx', // x2
    'apps/web/src/features/reveals/NewFranchises.tsx', // x5
    'apps/web/src/features/reveals/ProgressRing.tsx', // x2
    'apps/web/src/features/reveals/RevealHero.tsx', // x10
    'apps/web/src/features/reveals/RevealsPromoCard.tsx', // x1
    'apps/web/src/features/reveals/WhatsNewSection.tsx', // x3
    'apps/web/src/features/synergies/components/ColumnHeader.stories.tsx', // x3
    'apps/web/src/features/synergies/components/CommunityEmptyState.stories.tsx', // x1
    'apps/web/src/features/synergies/components/DeltaPanel.stories.tsx', // x1
    'apps/web/src/features/synergies/components/DeltaPanel.tsx', // x5
    'apps/web/src/features/synergies/components/MobileComparisonView.stories.tsx', // x2
    'apps/web/src/features/voting/components/DistributionBar.stories.tsx', // x1
    'apps/web/src/features/voting/components/DistributionBar.tsx', // x3
    'apps/web/src/features/voting/components/OptionPicker.stories.tsx', // x5
    'apps/web/src/features/voting/components/QuickVoteControl.stories.tsx', // x1
    'apps/web/src/features/voting/components/QuickVoteControl.tsx', // x3
    'apps/web/src/features/voting/components/ScorePicker.tsx', // x1
    'apps/web/src/features/voting/components/VoteAffirmation.stories.tsx', // x3
    'apps/web/src/features/voting/components/VoteFormSkeleton.stories.tsx', // x1
    'apps/web/src/features/voting/components/VoteProgress.tsx', // x1
    'apps/web/src/features/voting/components/VoteStatusBanner.tsx', // x9
    'apps/web/src/pages/NotFoundPage.tsx', // x5
    'packages/ui/src/lorcana/CardImage.stories.tsx', // x1
    'apps/web/src/shared/components/ConnectionGroup.stories.tsx', // x1
    'apps/web/src/shared/components/Footer.stories.tsx', // x1
    'packages/ui/src/components/CollapsibleSection.stories.tsx', // x1
    'packages/ui/src/components/CountBadge.tsx', // x1
    'packages/ui/src/components/EtherealBackground.tsx', // x1
    'packages/ui/src/components/FilterButton.stories.tsx', // x1
    'packages/ui/src/components/Sparkles.stories.tsx', // x9
    'packages/ui/src/components/Sparkles.tsx', // x1
    'packages/ui/src/lorcana/CardLightbox.stories.tsx', // x1
    'packages/ui/src/lorcana/CardTextBlock.stories.tsx', // x1
    'packages/ui/src/lorcana/RaritySymbol.stories.tsx', // x1
    'packages/ui/src/lorcana/StrengthBadge.stories.tsx', // x8
    'packages/ui/src/lorcana/TierCircle.stories.tsx', // x2
  ],
  // 63 files, 259 violations at seeding
  'no-raw-rgba': [
    'apps/web/src/features/playstyles/PlaystyleFanTile.tsx', // x6
    'apps/web/src/features/reveals/ProgressRing.tsx', // x1
    'apps/web/src/features/reveals/RevealHero.tsx', // x5
    'apps/web/src/features/reveals/RevealsPromoCard.tsx', // x1
    'apps/web/src/features/reveals/WhatsNewSection.tsx', // x4
    'apps/web/src/features/reveals/inkTint.ts', // x2
    'apps/web/src/features/synergies/components/DeltaPanel.tsx', // x4
    'apps/web/src/features/voting/components/DistributionBar.tsx', // x3
    'apps/web/src/features/voting/components/OptionPicker.stories.tsx', // x3
    'apps/web/src/features/voting/components/QuickVoteControl.tsx', // x21
    'apps/web/src/pages/NotFoundPage.tsx', // x4
    'apps/web/src/shared/components/BetaNotice.tsx', // x1
    'packages/ui/src/components/CountBadge.tsx', // x1
    'packages/ui/src/components/EtherealBackground.tsx', // x4
    'packages/ui/src/components/FilterButton.stories.tsx', // x1
    'packages/ui/src/components/Sparkles.stories.tsx', // x2
    'packages/ui/src/lorcana/AbilityCallout.tsx', // x1
  ],
  // 6 files, 15 violations at seeding
  'no-literal-font-family': [
    'apps/web/src/shared/components/Footer.stories.tsx', // x1
  ],
  // 44 files, 116 violations at seeding
  'no-raw-font-size': [
    'apps/web/src/features/reveals/NewFranchises.tsx', // x1
    'apps/web/src/features/reveals/RevealHero.tsx', // x1
    'apps/web/src/features/synergies/components/DeltaPanel.tsx', // x5
    'apps/web/src/features/voting/components/DistributionBar.tsx', // x2
    'apps/web/src/features/voting/components/ScorePicker.tsx', // x1
    'apps/web/src/features/voting/components/VoteAffirmation.tsx', // x3
    'apps/web/src/features/voting/components/VoteProgress.tsx', // x1
    'apps/web/src/features/voting/components/VoteStatusBanner.tsx', // x2
    'packages/ui/src/lorcana/CardImage.stories.tsx', // x1
    'apps/web/src/shared/components/MobileBottomNav.tsx', // x1
    'packages/ui/src/components/CollapsibleSection.stories.tsx', // x2
    'packages/ui/src/components/EmptyState.stories.tsx', // x3
    'packages/ui/src/components/Sparkles.stories.tsx', // x3
    'packages/ui/src/lorcana/RaritySymbol.stories.tsx', // x1
  ],
  // 62 files, 102 violations at seeding
  'no-raw-radius': [
    'apps/web/src/features/playstyles/PlaystyleFanTile.tsx', // x2
    'apps/web/src/features/reveals/NewFranchises.tsx', // x2
    'apps/web/src/features/reveals/RevealHero.tsx', // x2
    'apps/web/src/features/reveals/WhatsNewSection.tsx', // x1
    'apps/web/src/features/synergies/components/ColumnHeader.stories.tsx', // x1
    'apps/web/src/features/synergies/components/CommunityEmptyState.stories.tsx', // x1
    'apps/web/src/features/synergies/components/DeltaPanel.stories.tsx', // x1
    'apps/web/src/features/synergies/components/DeltaPanel.tsx', // x2
    'apps/web/src/features/synergies/components/EngineColumn.tsx', // x1
    'apps/web/src/features/synergies/components/MobileComparisonView.stories.tsx', // x1
    'apps/web/src/features/voting/components/DistributionBar.stories.tsx', // x1
    'apps/web/src/features/voting/components/DistributionBar.tsx', // x1
    'apps/web/src/features/voting/components/OptionPicker.stories.tsx', // x1
    'apps/web/src/features/voting/components/QuickVoteControl.stories.tsx', // x1
    'apps/web/src/features/voting/components/QuickVoteControl.tsx', // x1
    'apps/web/src/features/voting/components/ScorePicker.tsx', // x1
    'apps/web/src/features/voting/components/VoteAffirmation.stories.tsx', // x1
    'apps/web/src/features/voting/components/VoteStatusBanner.tsx', // x2
    'apps/web/src/shared/components/ConnectionGroup.stories.tsx', // x1
    'packages/ui/src/components/CollapsibleSection.stories.tsx', // x1
    'packages/ui/src/components/Sparkles.stories.tsx', // x3
    'packages/ui/src/lorcana/CardLightbox.stories.tsx', // x1
    'packages/ui/src/lorcana/CardTextBlock.stories.tsx', // x1
  ],
  // 5 files, 5 violations at seeding
  'no-raw-z-index': [
    'apps/web/src/features/reveals/RevealsPromoCard.tsx', // x1
    'apps/web/src/shared/components/BetaNotice.tsx', // x1
    'apps/web/src/shared/components/MobileBottomNav.tsx', // x1
  ],
  // 23 files, 54 violations at seeding
  'no-raw-easing': [
    'apps/web/src/features/reveals/WhatsNewSection.tsx', // x1
    'apps/web/src/features/voting/components/QuickVoteControl.tsx', // x6
  ],
  // Seeded 2026-10-22 when the rule turned on (#549), after it began reading
  // ternary branches, negative values and the logical properties. Stories and
  // src/docs/ are exempt, so none are listed.
  // 66 files, 191 violations at seeding
  'no-raw-spacing': [
    'apps/web/src/features/cards/components/BrowseToolbar.tsx', // x6
    'apps/web/src/features/cards/components/CardGrid.tsx', // x1
    'apps/web/src/features/collection/CollectionBinderSection.tsx', // x1
    'apps/web/src/features/playstyles/PlaystyleFanTile.tsx', // x3
    'apps/web/src/features/reveals/FranchiseCardsModal.tsx', // x2
    'apps/web/src/features/reveals/InkBoard.tsx', // x6
    'apps/web/src/features/reveals/NewFranchises.tsx', // x4
    'apps/web/src/features/reveals/RevealHero.tsx', // x7
    'apps/web/src/features/reveals/RevealsPromoCard.tsx', // x1
    'apps/web/src/features/reveals/SpotlightHero.tsx', // x5
    'apps/web/src/features/reveals/mosaicSizing.ts', // x1
    'apps/web/src/features/synergies/components/ColumnHeader.tsx', // x5
    'apps/web/src/features/synergies/components/DeltaPanel.tsx', // x4
    'apps/web/src/features/synergies/components/MobileComparisonView.tsx', // x4
    'apps/web/src/features/synergies/components/SynergyBreakdown.tsx', // x1
    'apps/web/src/features/synergies/components/SynergyToolbar.tsx', // x3
    'apps/web/src/features/voting/components/DistributionBar.tsx', // x4
    'apps/web/src/features/voting/components/ScorePicker.tsx', // x5
    'apps/web/src/pages/BrowsePage.tsx', // x1
    'apps/web/src/pages/InDepthVotePage.tsx', // x9
    'apps/web/src/pages/InkHubPage.tsx', // x1
    'apps/web/src/pages/NotFoundPage.tsx', // x1
    'apps/web/src/pages/PlaystyleGalleryPage.tsx', // x1
    'apps/web/src/pages/PrivacyPage.tsx', // x1
    'apps/web/src/pages/VotePage.tsx', // x7
    'apps/web/src/shared/components/BetaNotice.tsx', // x1
    'apps/web/src/shared/components/CompactHeader.tsx', // x2
    'apps/web/src/shared/components/ConnectionGroup.tsx', // x2
    'apps/web/src/shared/components/HeroSection.tsx', // x8
    'apps/web/src/shared/components/SearchBottomSheet.tsx', // x2
    'packages/ui/src/components/Chip.tsx', // x2
    'packages/ui/src/components/CtaButton.tsx', // x1
    'packages/ui/src/components/DialogShell.tsx', // x1
    'packages/ui/src/components/TabList.tsx', // x1
    'packages/ui/src/tokens/theme.ts', // x1
  ],
  // Ad-hoc styled <button> sites pre-dating the #509 kit. Converge each to a
  // kit component (CtaButton/LinkButton/TabList/IconButton/Chip) on touch.
  // 24 files, 29 sites at seeding (2026-07-22).
  'no-adhoc-buttons': [
    'apps/web/src/features/reveals/NewFranchises.tsx', // x1
    'apps/web/src/features/reveals/RevealsPromoCard.tsx', // x1
    'apps/web/src/features/reveals/WhatsNewSection.tsx', // x1
    'apps/web/src/features/voting/components/VoteStatusBanner.tsx', // x1
  ],
};
