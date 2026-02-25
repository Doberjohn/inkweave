# Task Log

## Current Status

Application is functional with card browsing, search/filter, and synergy detection. Deck builder was removed for MVP scope reduction. Dark fantasy design system foundation is in place. Mobile responsive layout complete.

- **Engine**: 8 synergy rules (Shift, Lore Loss, 6 Location rules) in standalone `lorcana-synergy-engine` package
- **Web**: Two-column desktop layout, tab-based mobile navigation
- **Tests**: 52 engine + 290 web = 342 unit tests; 31 E2E tests passing
- **Infrastructure**: Vercel hosting, Sentry error tracking (EU/DE), Vercel Analytics, Ahrefs, SEO (JSON-LD, semantic HTML, sitemap)

---

## MVP Roadmap

See [GitHub Issues](https://github.com/Doberjohn/lorcana-synergy-finder/issues) for full backlog.

### Epic 1: MVP Scope Reduction (#28)
- [x] Remove Deck Builder — #33 (PR #67)
- [ ] Remove Infinity Mode — #34

### Epic 2: Dark Fantasy UI Theme (#29)
- [x] Design System Foundation — #35 (PR #69)
- [ ] Card Grid Transformation — #36
- [ ] Synergy Panel Redesign — #37
- [ ] Header, Filters, and Polish — #38

### Epic 3: Synergy Categories (#30)
- [ ] Synergy Category Infrastructure (Direct + Playstyle) — #39
- [ ] Discard Archetype — #40 (mvp)
- [ ] Bounce Archetype — #41 (post-mvp)
- [ ] Ramp Archetype — #42 (post-mvp)
- [ ] Damage/Removal Archetype — #43 (post-mvp)

### Epic 4: Synergy Panel Redesign (#31)
- [ ] SynergyCard Restyle — #44
- [ ] Archetype Grouping — #45
- [ ] Archetype Filtering — #46

### Epic 5: Launch Readiness (#32)
- [ ] MVP Testing — #47
- [ ] MVP Documentation — #48
- [ ] MVP Final Polish — #49

### Additional MVP Issues
- [ ] 'Show all cards' button per synergy category — #113
- [ ] Filtering for synergy result cards — #114
- [ ] Detailed synergy view between two cards — #115
- [ ] Accessibility pass — #121

---

## Backlog (Post-MVP)

### Synergy Evolution
- [x] Numeric scoring (1-10 scale) — #132
- [ ] Community voting for synergies — #9
- [ ] User-created synergies + sharing — #8
- [ ] Embeddable Synergy Widget — #58

### Infrastructure
- [ ] Protect synergy rules in production — #14
- [ ] Bundle analyzer in CI — #123
- [ ] npm audit in CI — #125
- [ ] PWA support — #122
- [ ] Custom event tracking — #124
- [ ] Image optimization pipeline — #126

### Refactoring
- [ ] Split CardPreviewContext for React Fast Refresh — #27
- [ ] Reduce test file verbosity — #26
- [ ] Audit and fix performance issues — #25

---

## Known Issues

None currently tracked.

---

## Recently Completed

- [x] SEO: JSON-LD, semantic HTML, alt text, font preloading (#130, PR #131)
- [x] Sentry integration: error tracking, source maps, console logs
- [x] Refactor landing page (#112, PR #117)
- [x] Desktop browse layout redesign (#86, PR #116)
- [x] Dark Fantasy Design System Foundation (#35, PR #69)
- [x] Import type cleanup and E2E tsconfig fix (#68)
- [x] Remove Deck Builder for MVP (#33, PR #67)
- [x] App branding: "Inkweave", domain + Vercel configured
- [x] E2E testing with Playwright (#11, #24)
- [x] Vercel Analytics and Speed Insights (#13, #19)
- [x] Mobile responsive layout with touch support
- [x] Two rounds of code review: 30+ items resolved (performance, accessibility, error handling, testing)
