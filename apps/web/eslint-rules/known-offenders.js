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
    'src/features/reveals/InkBoard.tsx', // x7
    'src/features/reveals/NewFranchises.tsx', // x5
    'src/features/reveals/ProgressRing.tsx', // x2
    'src/features/reveals/RarityBreakdown.tsx', // x6
    'src/features/reveals/RaritySymbol.stories.tsx', // x1
    'src/features/reveals/RevealHero.tsx', // x10
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/SpotlightHero.tsx', // x6
    'src/features/reveals/WhatsNewSection.tsx', // x3
    'src/features/reveals/setSpotlights.ts', // x1
    'src/features/synergies/components/ColumnHeader.stories.tsx', // x3
    'src/features/synergies/components/CommunityEmptyState.stories.tsx', // x1
    'src/features/synergies/components/CommunityEmptyState.tsx', // x2
    'src/features/synergies/components/DeltaPanel.stories.tsx', // x1
    'src/features/synergies/components/DeltaPanel.tsx', // x5
    'src/features/synergies/components/MobileComparisonView.stories.tsx', // x2
    'src/features/synergies/components/MobileComparisonView.tsx', // x4
    'src/features/synergies/components/RoleTileRow.stories.tsx', // x1
    'src/features/synergies/components/RoleTileRow.tsx', // x3
    'src/features/synergies/components/SynergyBanner.tsx', // x1
    'src/features/synergies/components/SynergyGroup.tsx', // x1
    'src/features/voting/components/DistributionBar.stories.tsx', // x1
    'src/features/voting/components/DistributionBar.tsx', // x3
    'src/features/voting/components/InDepthVoteForm.stories.tsx', // x1
    'src/features/voting/components/InDepthVoteForm.tsx', // x8
    'src/features/voting/components/OptionPicker.stories.tsx', // x5
    'src/features/voting/components/QuickVoteControl.stories.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x3
    'src/features/voting/components/ScorePicker.tsx', // x1
    'src/features/voting/components/VoteAffirmation.stories.tsx', // x3
    'src/features/voting/components/VoteFormSkeleton.stories.tsx', // x1
    'src/features/voting/components/VoteProgress.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x9
    'src/pages/BannerPage.tsx', // x1
    'src/pages/NotFoundPage.tsx', // x5
    'src/shared/components/CardImage.stories.tsx', // x1
    'src/shared/components/CardLightbox.stories.tsx', // x1
    'src/shared/components/CardTextBlock.stories.tsx', // x1
    'src/shared/components/CollapsibleSection.stories.tsx', // x1
    'src/shared/components/ConnectionGroup.stories.tsx', // x1
    'src/shared/components/ConnectionGroup.tsx', // x13
    'src/shared/components/CountBadge.tsx', // x1
    'src/shared/components/EtherealBackground.tsx', // x1
    'src/shared/components/FilterButton.stories.tsx', // x1
    'src/shared/components/FilterContent.stories.tsx', // x3
    'src/shared/components/FilterSection.stories.tsx', // x2
    'src/shared/components/Footer.stories.tsx', // x1
    'src/shared/components/Sparkles.stories.tsx', // x9
    'src/shared/components/Sparkles.tsx', // x1
    'src/shared/components/StrengthBadge.stories.tsx', // x8
    'src/shared/components/TierCircle.stories.tsx', // x2
    'src/shared/components/Tooltip.stories.tsx', // x2
  ],
  // 63 files, 259 violations at seeding
  'no-raw-rgba': [
    'src/features/cards/components/BrowseToolbar.tsx', // x2
    'src/features/cards/components/CardTile.tsx', // x2
    'src/features/playstyles/PlaystyleFanTile.tsx', // x6
    'src/features/reveals/CardSlot.tsx', // x5
    'src/features/reveals/InkBoard.tsx', // x2
    'src/features/reveals/ProgressRing.tsx', // x1
    'src/features/reveals/RarityBreakdown.tsx', // x3
    'src/features/reveals/RevealHero.tsx', // x5
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/SpotlightHero.tsx', // x13
    'src/features/reveals/WhatsNewSection.tsx', // x4
    'src/features/reveals/inkTint.ts', // x2
    'src/features/synergies/components/CardDetail.tsx', // x1
    'src/features/synergies/components/CommunityEmptyState.tsx', // x3
    'src/features/synergies/components/DeltaPanel.tsx', // x4
    'src/features/synergies/components/MechanicsButton.tsx', // x5
    'src/features/synergies/components/MobileComparisonView.tsx', // x16
    'src/features/synergies/components/RoleTileRow.tsx', // x3
    'src/features/synergies/components/SynergyBanner.tsx', // x16
    'src/features/synergies/components/SynergyCard.tsx', // x2
    'src/features/synergies/components/SynergyGroup.tsx', // x2
    'src/features/voting/components/DistributionBar.tsx', // x3
    'src/features/voting/components/InDepthVoteForm.tsx', // x9
    'src/features/voting/components/OptionPicker.stories.tsx', // x3
    'src/features/voting/components/QuickVoteControl.tsx', // x21
    'src/pages/NotFoundPage.tsx', // x4
    'src/shared/components/AbilityCallout.tsx', // x1
    'src/shared/components/BetaNotice.tsx', // x1
    'src/shared/components/ConnectionGroup.tsx', // x5
    'src/shared/components/CountBadge.tsx', // x1
    'src/shared/components/EtherealBackground.tsx', // x4
    'src/shared/components/FilterButton.stories.tsx', // x1
    'src/shared/components/HeroSection.tsx', // x2
    'src/shared/components/Sparkles.stories.tsx', // x2
    'src/shared/components/Tooltip.stories.tsx', // x3
  ],
  // 6 files, 15 violations at seeding
  'no-literal-font-family': [
    'src/docs/Colors.stories.tsx', // x10
    'src/features/synergies/components/SynergyBanner.tsx', // x1
    'src/shared/components/Footer.stories.tsx', // x1
  ],
  // 44 files, 116 violations at seeding
  'no-raw-font-size': [
    'src/docs/Colors.stories.tsx', // x10
    'src/docs/SpacingLayout.stories.tsx', // x2
    'src/docs/Typography.stories.tsx', // x5
    'src/features/admin-analytics/Scorecard.tsx', // x1
    'src/features/reveals/InkBoard.tsx', // x3
    'src/features/reveals/NewFranchises.tsx', // x1
    'src/features/reveals/RarityBreakdown.tsx', // x1
    'src/features/reveals/RaritySymbol.stories.tsx', // x1
    'src/features/reveals/RevealHero.tsx', // x1
    'src/features/reveals/SpotlightHero.tsx', // x3
    'src/features/synergies/components/CommunityEmptyState.tsx', // x2
    'src/features/synergies/components/DeltaPanel.tsx', // x5
    'src/features/synergies/components/MobileComparisonView.tsx', // x3
    'src/features/synergies/components/SynergyBanner.tsx', // x5
    'src/features/voting/components/DistributionBar.tsx', // x2
    'src/features/voting/components/ScorePicker.tsx', // x1
    'src/features/voting/components/VoteAffirmation.tsx', // x3
    'src/features/voting/components/VoteProgress.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x2
    'src/pages/HomePageSkeleton.tsx', // x2
    'src/shared/components/CardImage.stories.tsx', // x1
    'src/shared/components/Chip.stories.tsx', // x1
    'src/shared/components/CollapsibleSection.stories.tsx', // x2
    'src/shared/components/ConnectionGroup.tsx', // x1
    'src/shared/components/EmptyState.stories.tsx', // x3
    'src/shared/components/MobileBottomNav.tsx', // x1
    'src/shared/components/Sparkles.stories.tsx', // x3
    'src/shared/components/Tooltip.stories.tsx', // x2
  ],
  // 62 files, 102 violations at seeding
  'no-raw-radius': [
    'src/docs/Colors.stories.tsx', // x2
    'src/docs/SpacingLayout.stories.tsx', // x4
    'src/features/image-admin/components/CardImagePicker.tsx', // x1
    'src/features/playstyles/PlaystyleFanTile.tsx', // x2
    'src/features/reveals/CardSlot.tsx', // x1
    'src/features/reveals/InkBoard.tsx', // x1
    'src/features/reveals/NewFranchises.tsx', // x2
    'src/features/reveals/RarityBreakdown.tsx', // x1
    'src/features/reveals/RevealHero.tsx', // x2
    'src/features/reveals/SpotlightHero.tsx', // x4
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/synergies/components/ColumnHeader.stories.tsx', // x1
    'src/features/synergies/components/CommunityEmptyState.stories.tsx', // x1
    'src/features/synergies/components/CommunityEmptyState.tsx', // x1
    'src/features/synergies/components/DeltaPanel.stories.tsx', // x1
    'src/features/synergies/components/DeltaPanel.tsx', // x2
    'src/features/synergies/components/EngineColumn.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.stories.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.tsx', // x2
    'src/features/synergies/components/RoleTileRow.tsx', // x3
    'src/features/synergies/components/SynergyBanner.tsx', // x4
    'src/features/voting/components/DistributionBar.stories.tsx', // x1
    'src/features/voting/components/DistributionBar.tsx', // x1
    'src/features/voting/components/InDepthVoteForm.stories.tsx', // x1
    'src/features/voting/components/InDepthVoteForm.tsx', // x1
    'src/features/voting/components/OptionPicker.stories.tsx', // x1
    'src/features/voting/components/QuickVoteControl.stories.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x1
    'src/features/voting/components/ScorePicker.tsx', // x1
    'src/features/voting/components/VoteAffirmation.stories.tsx', // x1
    'src/features/voting/components/VoteStatusBanner.tsx', // x2
    'src/pages/BrowsePage.tsx', // x1
    'src/shared/components/CardLightbox.stories.tsx', // x1
    'src/shared/components/CardTextBlock.stories.tsx', // x1
    'src/shared/components/CollapsibleSection.stories.tsx', // x1
    'src/shared/components/ConnectionGroup.stories.tsx', // x1
    'src/shared/components/ConnectionGroup.tsx', // x1
    'src/shared/components/FilterContent.stories.tsx', // x3
    'src/shared/components/FilterSection.stories.tsx', // x2
    'src/shared/components/Sparkles.stories.tsx', // x3
  ],
  // 5 files, 5 violations at seeding; fully converged onto Z_INDEX.promo/nav
  // by the #511 Wave-2 ruling (parked-token adoption).
  'no-raw-z-index': [],
  // 23 files, 54 violations at seeding
  // RE-SEEDED 2026-07-29 when no-raw-easing became a string scan: 14 files -> 23.
  // This is the ONE sanctioned way the ledger grows, and only because the RULE
  // widened, not because drift did. Every added entry is pre-enforcement code the
  // property-shaped rule could not see (ternary values, hoisted consts, el.style
  // assignments, injected cssText) -- measured with the ledger emptied and all 47
  // reported lines hand-inspected. BrowseToolbar.tsx DROPS OUT: it already uses
  // ${EASING.snappy} and its old entry was stale, so the re-seed drains one.
  // Normal shrink-only discipline resumes from here.
  'no-raw-easing': [
    'src/features/deck/components/QuantityStepper.tsx', // x1 (ternary)
    'src/features/reveals/CardSlot.tsx', // x1
    'src/features/reveals/InkBoard.tsx', // x1
    'src/features/reveals/RarityBreakdown.tsx', // x1
    'src/features/reveals/RevealsPromoCard.tsx', // x1 (injected cssText)
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/synergies/components/CardOverviewModal.tsx', // x7 (hoisted const + el.style)
    'src/features/synergies/components/CommunityEmptyState.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.tsx', // x5 (hoisted const)
    'src/features/synergies/components/MobileLightbox.tsx', // x1 (hoisted const)
    'src/features/synergies/components/RoleTileRow.tsx', // x3
    'src/features/synergies/components/SynergyCard.tsx', // x1
    'src/features/voting/components/InDepthVoteForm.tsx', // x1 (ternary)
    'src/features/voting/components/OptionPicker.tsx', // x2 (ternary)
    'src/features/voting/components/PairDisplay.tsx', // x2 (ternary)
    'src/features/voting/components/PairStack.tsx', // x1
    'src/features/voting/components/QuickVoteControl.tsx', // x6
    'src/features/voting/components/ScorePicker.tsx', // x1 (ternary)
    'src/shared/components/CardImage.tsx', // x1
    'src/shared/components/ConnectionGroup.tsx', // x5
    'src/shared/components/HeroSection.tsx', // x1
    'src/shared/components/MobileBottomNav.tsx', // x2 (injected cssText)
    'src/shared/components/Sparkles.tsx', // x1
  ],
  // 0 files, 0 violations at seeding
  'no-raw-spacing': [
  ],
  // Ad-hoc styled <button> sites pre-dating the #509 kit. Converge each to a
  // kit component (CtaButton/LinkButton/TabList/IconButton/Chip) on touch.
  // 24 files, 29 sites at seeding (2026-07-22).
  'no-adhoc-buttons': [
    'src/features/admin-analytics/DayGroup.tsx', // x1
    'src/features/admin-analytics/PairList.tsx', // x1
    'src/features/admin-analytics/RuleCalibrationTable.tsx', // x1
    'src/features/admin-analytics/WebAnalyticsView.tsx', // x1
    'src/features/synergies/components/CardDetailPanel.tsx', // x1
    'src/features/synergies/components/ColumnHeader.tsx', // x1
    'src/features/synergies/components/MobileCardDetail.tsx', // x1
    'src/features/image-admin/components/CardImagePicker.tsx', // x1
    'src/features/reveals/NewFranchises.tsx', // x1
    'src/features/reveals/RarityBreakdown.tsx', // x1
    'src/features/reveals/RevealsPromoCard.tsx', // x1
    'src/features/reveals/SpotlightHero.tsx', // x1
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/synergies/components/CardDetail.tsx', // x1
    'src/features/synergies/components/CardOverviewModal.tsx', // x2
    'src/features/synergies/components/MechanicsButton.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.tsx', // x2
    'src/features/synergies/components/SynergyGroup.tsx', // x1
    'src/features/tuning-admin/components/PendingTray.tsx', // x2
    'src/features/tuning-admin/components/RuleSelector.tsx', // x2
    'src/features/voting/components/InDepthVoteForm.tsx', // x2
    'src/features/voting/components/VoteStatusBanner.tsx', // x1
  ],

  // 28 files, 60 violations at seeding (2026-07-29). The one-gold ruling
  // predates this rule by a week, so these are pre-enforcement drift, not new.
  'no-legacy-gold': [
    'src/features/cards/components/BrowseToolbar.tsx', // x1
    'src/features/reveals/RevealsPromoCard.tsx', // x3
    'src/features/reveals/WhatsNewSection.tsx', // x1
    'src/features/synergies/components/CardDetailPanel.tsx', // x6
    'src/features/synergies/components/CardOverviewModal.tsx', // x5
    'src/features/synergies/components/ColumnHeader.tsx', // x3
    'src/features/synergies/components/DeltaPanel.tsx', // x1
    'src/features/synergies/components/EngineColumn.tsx', // x1
    'src/features/synergies/components/MobileComparisonView.tsx', // x5
    'src/features/synergies/components/RoleTileRow.tsx', // x1
    'src/features/synergies/components/SynergyGroup.tsx', // x1
    'src/features/voting/components/OptionPicker.tsx', // x1
    'src/features/voting/components/PairDisplay.tsx', // x4
    'src/features/voting/components/QuickVoteControl.tsx', // x1
    'src/features/voting/components/VoteConfirmation.tsx', // x2
    'src/features/voting/components/VoteToast.tsx', // x1
    'src/features/voting/components/VotingCardDisplay.tsx', // x2
    'src/pages/ImageAdminPage.tsx', // x1
    'src/pages/InDepthVotePage.tsx', // x6
    'src/pages/NotFoundPage.tsx', // x3
    'src/pages/PlaystyleDetailPage.tsx', // x1
    'src/pages/RevealAdminPage.tsx', // x1
    'src/shared/components/BackLink.tsx', // x1
    'src/shared/components/CardLightbox.tsx', // x3
    'src/shared/components/ErrorBoundary.tsx', // x1
    'src/shared/components/FilterButton.tsx', // x1
    'src/shared/components/FilterContent.tsx', // x2
    'src/shared/components/InkwellFilterGroup.tsx', // x1
  ],
};
