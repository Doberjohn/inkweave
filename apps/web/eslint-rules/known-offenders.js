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
    'src/features/cards/components/CardDetailSkeleton.stories.tsx', // x1
    'src/features/cards/components/CardGridSkeleton.stories.tsx', // x1
    'src/features/playstyles/PlaystyleFanTile.stories.tsx', // x2
    'src/features/playstyles/PlaystyleFanTile.tsx', // x2
    'src/features/playstyles/PlaystyleSection.stories.tsx', // x2
    'src/features/reveals/NewFranchises.tsx', // x5
    'src/features/reveals/ProgressRing.tsx', // x2
    'src/features/reveals/RaritySymbol.stories.tsx', // x1
    'src/features/reveals/RevealHero.tsx', // x10
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/WhatsNewSection.tsx', // x3
    'src/features/synergies/components/ColumnHeader.stories.tsx', // x3
    'src/features/synergies/components/CommunityEmptyState.stories.tsx', // x1
    'src/features/synergies/components/DeltaPanel.stories.tsx', // x1
    'src/features/synergies/components/DeltaPanel.tsx', // x5
    'src/features/synergies/components/MobileComparisonView.stories.tsx', // x2
    'src/features/voting/components/DistributionBar.stories.tsx', // x1
    'src/features/voting/components/DistributionBar.tsx', // x3
    'src/features/voting/components/OptionPicker.stories.tsx', // x5
    'src/features/voting/components/QuickVoteControl.stories.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x3
    'src/features/voting/components/ScorePicker.tsx', // x1
    'src/features/voting/components/VoteAffirmation.stories.tsx', // x3
    'src/features/voting/components/VoteFormSkeleton.stories.tsx', // x1
    'src/features/voting/components/VoteProgress.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x9
    'src/pages/NotFoundPage.tsx', // x5
    'src/shared/components/CardImage.stories.tsx', // x1
    'src/shared/components/CardLightbox.stories.tsx', // x1
    'src/shared/components/CardTextBlock.stories.tsx', // x1
    'src/shared/components/CollapsibleSection.stories.tsx', // x1
    'src/shared/components/ConnectionGroup.stories.tsx', // x1
    'src/shared/components/CountBadge.tsx', // x1
    'src/shared/components/EtherealBackground.tsx', // x1
    'src/shared/components/FilterButton.stories.tsx', // x1
    'src/shared/components/Footer.stories.tsx', // x1
    'src/shared/components/Sparkles.stories.tsx', // x9
    'src/shared/components/Sparkles.tsx', // x1
    'src/shared/components/StrengthBadge.stories.tsx', // x8
    'src/shared/components/TierCircle.stories.tsx', // x2
  ],
  // 63 files, 259 violations at seeding
  'no-raw-rgba': [
    'src/features/playstyles/PlaystyleFanTile.tsx', // x6
    'src/features/reveals/ProgressRing.tsx', // x1
    'src/features/reveals/RevealHero.tsx', // x5
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/WhatsNewSection.tsx', // x4
    'src/features/reveals/inkTint.ts', // x2
    'src/features/synergies/components/DeltaPanel.tsx', // x4
    'src/features/synergies/components/MechanicsButton.tsx', // x5
    'src/features/voting/components/DistributionBar.tsx', // x3
    'src/features/voting/components/OptionPicker.stories.tsx', // x3
    'src/features/voting/components/QuickVoteControl.tsx', // x21
    'src/pages/NotFoundPage.tsx', // x4
    'src/shared/components/AbilityCallout.tsx', // x1
    'src/shared/components/BetaNotice.tsx', // x1
    'src/shared/components/CountBadge.tsx', // x1
    'src/shared/components/EtherealBackground.tsx', // x4
    'src/shared/components/FilterButton.stories.tsx', // x1
    'src/shared/components/Sparkles.stories.tsx', // x2
  ],
  // 6 files, 15 violations at seeding
  'no-literal-font-family': [
    'src/shared/components/Footer.stories.tsx', // x1
  ],
  // 44 files, 116 violations at seeding
  'no-raw-font-size': [
    'src/features/reveals/NewFranchises.tsx', // x1
    'src/features/reveals/RaritySymbol.stories.tsx', // x1
    'src/features/reveals/RevealHero.tsx', // x1
    'src/features/synergies/components/DeltaPanel.tsx', // x5
    'src/features/voting/components/DistributionBar.tsx', // x2
    'src/features/voting/components/ScorePicker.tsx', // x1
    'src/features/voting/components/VoteAffirmation.tsx', // x3
    'src/features/voting/components/VoteProgress.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x2
    'src/pages/HomePageSkeleton.tsx', // x2
    'src/shared/components/CardImage.stories.tsx', // x1
    'src/shared/components/CollapsibleSection.stories.tsx', // x2
    'src/shared/components/EmptyState.stories.tsx', // x3
    'src/shared/components/MobileBottomNav.tsx', // x1
    'src/shared/components/Sparkles.stories.tsx', // x3
  ],
  // 62 files, 102 violations at seeding
  'no-raw-radius': [
    'src/features/playstyles/PlaystyleFanTile.tsx', // x2
    'src/features/reveals/NewFranchises.tsx', // x2
    'src/features/reveals/RevealHero.tsx', // x2
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/synergies/components/ColumnHeader.stories.tsx', // x1
    'src/features/synergies/components/CommunityEmptyState.stories.tsx', // x1
    'src/features/synergies/components/DeltaPanel.stories.tsx', // x1
    'src/features/synergies/components/DeltaPanel.tsx', // x2
    'src/features/synergies/components/EngineColumn.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.stories.tsx', // x1
    'src/features/voting/components/DistributionBar.stories.tsx', // x1
    'src/features/voting/components/DistributionBar.tsx', // x1
    'src/features/voting/components/OptionPicker.stories.tsx', // x1
    'src/features/voting/components/QuickVoteControl.stories.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x1
    'src/features/voting/components/ScorePicker.tsx', // x1
    'src/features/voting/components/VoteAffirmation.stories.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x2
    'src/shared/components/CardLightbox.stories.tsx', // x1
    'src/shared/components/CardTextBlock.stories.tsx', // x1
    'src/shared/components/CollapsibleSection.stories.tsx', // x1
    'src/shared/components/ConnectionGroup.stories.tsx', // x1
    'src/shared/components/Sparkles.stories.tsx', // x3
  ],
  // 5 files, 5 violations at seeding
  'no-raw-z-index': [
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/shared/components/BetaNotice.tsx', // x1
    'src/shared/components/MobileBottomNav.tsx', // x1
  ],
  // 23 files, 54 violations at seeding
  'no-raw-easing': [
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/voting/components/PairStack.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x6
    'src/shared/components/CardImage.tsx', // x1
  ],
  // Seeded 2026-10-22 when the rule turned on (#549), after it began reading
  // ternary branches, negative values and the logical properties. Stories,
  // src/docs/ and theme.ts are exempt, so none are listed.
  // 65 files, 190 violations at seeding
  'no-raw-spacing': [
    'src/features/cards/components/BinderSpreadMap.tsx', // x1
    'src/features/cards/components/BrowseCardGrid.tsx', // x1
    'src/features/cards/components/BrowseToolbar.tsx', // x6
    'src/features/cards/components/CardGrid.tsx', // x1
    'src/features/collection/CollectionBinderSection.tsx', // x1
    'src/features/playstyles/PlaystyleFanTile.tsx', // x3
    'src/features/playstyles/PlaystyleSection.tsx', // x2
    'src/features/reveals/CardMosaic.tsx', // x1
    'src/features/reveals/FranchiseCardsModal.tsx', // x2
    'src/features/reveals/InkBoard.tsx', // x6
    'src/features/reveals/NewFranchises.tsx', // x4
    'src/features/reveals/RevealHero.tsx', // x7
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/SpotlightHero.tsx', // x5
    'src/features/reveals/mosaicSizing.ts', // x1
    'src/features/synergies/components/CardDetailPanel.tsx', // x2
    'src/features/synergies/components/CardOverviewModal.tsx', // x7
    'src/features/synergies/components/CardOverviewModalFallback.tsx', // x4
    'src/features/synergies/components/ColumnHeader.tsx', // x5
    'src/features/synergies/components/CommunityColumn.tsx', // x6
    'src/features/synergies/components/CommunityEmptyState.tsx', // x5
    'src/features/synergies/components/DeltaPanel.tsx', // x4
    'src/features/synergies/components/EngineColumn.tsx', // x1
    'src/features/synergies/components/MechanicsButton.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.tsx', // x4
    'src/features/synergies/components/RoleTileRow.tsx', // x2
    'src/features/synergies/components/ScoreChevronsTab.tsx', // x2
    'src/features/synergies/components/SynergyBreakdown.tsx', // x1
    'src/features/synergies/components/SynergyToolbar.tsx', // x3
    'src/features/synergies/components/cardOverviewModalStyles.ts', // x4
    'src/features/voting/components/DistributionBar.tsx', // x4
    'src/features/voting/components/PairDisplay.tsx', // x9
    'src/features/voting/components/PairStack.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x3
    'src/features/voting/components/ScorePicker.tsx', // x5
    'src/features/voting/components/VoteAffirmation.tsx', // x2
    'src/features/voting/components/VoteConfirmation.tsx', // x5
    'src/features/voting/components/VoteGroupTabs.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x1
    'src/features/voting/components/VoteToast.tsx', // x4
    'src/features/voting/components/VotingCardDisplay.tsx', // x2
    'src/pages/BrowsePage.tsx', // x1
    'src/pages/HomePageSkeleton.tsx', // x8
    'src/pages/InDepthVotePage.tsx', // x9
    'src/pages/InkHubPage.tsx', // x1
    'src/pages/NotFoundPage.tsx', // x1
    'src/pages/PlaystyleDetailPage.tsx', // x2
    'src/pages/PlaystyleGalleryPage.tsx', // x1
    'src/pages/PrivacyPage.tsx', // x1
    'src/pages/RevealsPage.tsx', // x2
    'src/pages/VotePage.tsx', // x7
    'src/shared/components/BetaNotice.tsx', // x1
    'src/shared/components/Chip.tsx', // x2
    'src/shared/components/CompactHeader.tsx', // x2
    'src/shared/components/ConnectionGroup.tsx', // x2
    'src/shared/components/CostFilterGroup.tsx', // x1
    'src/shared/components/CtaButton.tsx', // x1
    'src/shared/components/DialogShell.tsx', // x1
    'src/shared/components/FilterContent.tsx', // x3
    'src/shared/components/HeroSection.tsx', // x8
    'src/shared/components/InkFilterGroup.tsx', // x1
    'src/shared/components/InkwellFilterGroup.tsx', // x1
    'src/shared/components/SearchBottomSheet.tsx', // x2
    'src/shared/components/TabList.tsx', // x1
    'src/shared/components/ToolbarToggle.tsx', // x1
  ],
  // Ad-hoc styled <button> sites pre-dating the #509 kit. Converge each to a
  // kit component (CtaButton/LinkButton/TabList/IconButton/Chip) on touch.
  // 24 files, 29 sites at seeding (2026-07-22).
  'no-adhoc-buttons': [
    'src/features/reveals/NewFranchises.tsx', // x1
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/synergies/components/MechanicsButton.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x1
  ],
};
