# Area 7 — Ravensburger Community Code & Footer Precedent (duels.ink)

**Added 2026-07-09** after the user pointed to how [duels.ink](https://duels.ink) handles its footer. This supersedes the vague "fan project / fair use" framing in [`04-third-party-services-gdpr.md`](04-third-party-services-gdpr.md) §5: fan Lorcana projects do not rely on generic fair use, they operate under **Ravensburger's Community Code Policy**, which provides a standardized attribution notice.

## Scope
Documents (1) the governing legal framework for using Disney Lorcana IP, (2) the standardized community-content disclaimer template and an Inkweave adaptation, (3) the non-commercial constraint this puts on the Terms of Use, and (4) the concrete footer pattern to model. Marks clearly what is verified vs. what a human must confirm against the source PDF before publishing.

---

## 1. The governing framework: Ravensburger's Community Code

- **What it is:** the official policy under which the community may use Disney Lorcana trademarks and copyrights (card names, images, logos) in fan-made content, tools, and events.
- **Source (authoritative):** [`cdn.ravensburger.com/lorcana/community-code-en`](https://cdn.ravensburger.com/lorcana/community-code-en) (PDF), "Disney Lorcana Community Code, effective May 10, 2023." German version: `.../community-code-de`. A mirror copy is hosted by melee.gg.
- **Limitation of this research:** the Code is a FlateDecode-compressed PDF; it could not be machine-read in this session (no poppler/pdftotext installed, and the body is not extractable via `strings`). The internal clauses (exact permitted uses, logo rules, attribution specifics) should be read from the PDF by the user or counsel. What follows is grounded in the standardized notice fan sites display (including the user's duels.ink reference) plus the web-search corroboration, not a line-by-line read of the Code.

## 2. The standardized community-content disclaimer

Ravensburger provides a community-content attribution notice that fan sites reproduce near-verbatim. The four required elements are:

1. Attribution: the project uses trademarks/copyrights associated with Disney Lorcana TCG, **used under Ravensburger's Community Code Policy**.
2. Non-commercial: the project is **expressly prohibited from charging** users to use or access the content.
3. Non-endorsement: the project is **not published, endorsed, or specifically approved by Disney or Ravensburger**.
4. Pointer: **for more information visit disneylorcana.com**.

### Verified precedent (duels.ink, provided by the user)
> Duels.ink uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under Ravensburger's Community Code Policy. We are expressly prohibited from charging you to use or access this content. Duels.ink is not published, endorsed, or specifically approved by Disney or Ravensburger. For more information about Disney Lorcana TCG, visit disneylorcana.com.

Other Lorcana community sites (Lorcana Player, Mushu Report) carry the same four elements, confirming this is the standard template rather than one site's invention.

### Proposed Inkweave adaptation (only the product noun changes)
> Inkweave uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under Ravensburger's Community Code Policy. We are expressly prohibited from charging you to use or access this content. Inkweave is not published, endorsed, or specifically approved by Disney or Ravensburger. For more information about Disney Lorcana TCG, visit [disneylorcana.com](https://www.disneylorcana.com).

**Confirm before publishing:** that this is still the current required wording (read the effective Community Code PDF / the disneylorcana resources page), and whether Ravensburger requires the notice at a specific prominence (footer of every page vs. a dedicated page). The user's duels.ink example puts it in the footer sitewide.

This replaces the earlier proposed skeleton in doc 04 §5, which used a "not affiliated / fair use" framing. The Community Code wording ("used under Ravensburger's Community Code Policy", "expressly prohibited from charging", "not published, endorsed, or specifically approved") is more accurate and is what Ravensburger actually asks community projects to display. The issue #219 body's own strings ("not affiliated with, endorsed by, or sponsored by Disney, Ravensburger, or Lorcana"; "Card images and game content are property of their respective owners") are compatible and can be kept as supporting lines on the dedicated IP Disclaimer page.

## 3. Terms of Use implication: non-commercial is mandatory

The "expressly prohibited from charging you to use or access this content" clause is not boilerplate: it is a Community Code term. Consequences for Inkweave:

- The site and all card-content features (browse, synergies, deck builder) must remain **free to access**. Inkweave cannot gate the Lorcana card content behind payment.
- This should be stated in the Terms of Use, and it constrains any future monetization (a premium tier over the card content would violate the Code). Donations/ads are a separate question the user should verify against the Code before relying on them.
- Flag to the user: if there is any intent to monetize, that must be checked against the Community Code first.

## 4. Footer pattern (model on duels.ink)

The duels.ink footer is a two-part layout:

- **Line 1 (identity + nav):** brand + a short "unofficial ... " descriptor, then inline links. duels.ink shows: `Duels.ink unofficial Disney Lorcana Simulator · About · Privacy · contact@duels.ink`.
- **Line 2 (disclaimer paragraph):** the four-element notice from §2, in muted small text.

### Proposed Inkweave footer
- **Identity + nav line:** `Inkweave · unofficial Disney Lorcana synergy finder` then `About · Privacy · Terms · Disclaimer · <contact>`.
  - "synergy finder" (or "synergy finder & deck builder") replaces duels.ink's "Simulator" to describe Inkweave accurately.
  - Links go to `/about`, `/privacy`, `/terms`, `/disclaimer` (per doc 01 §4). The IP Disclaimer can be the dedicated page AND the footer paragraph (both), matching duels.ink which shows the paragraph inline and links a separate About/Privacy.
  - `<contact>` is an unresolved decision (no contact address exists in the repo, doc 06). duels.ink uses a first-party address (`contact@duels.ink`); Inkweave would want an equivalent (e.g. an `@inkweave.ink` address) rather than a personal Gmail.
- **Disclaimer line:** the §2 Inkweave notice, in `COLORS.textMuted` (#90a1b9) at a small size (`FONT_SIZES.xs`/`sm`), links (`disneylorcana.com`) in `COLORS.primary`.

### Placement (unchanged from doc 02)
Render the footer on the pages that scroll naturally (Home + the four legal pages), not globally in `AppLayout`, because the `height:100vh` tool pages (Browse/Vote) would push it below the fold or behind the fixed mobile nav. If a sitewide footer is truly wanted, note that duels.ink is a different layout model; matching it would require the tool-page height refactor that is out of #219 scope. This is decision #9 in the README.

Because the footer is a shared component (`shared/components/Footer.tsx`), it needs a co-located `Footer.stories.tsx` with a `MemoryRouter` decorator to pass the `check:stories` gate (doc 05/06).

## 5. Net changes to the plan
- **IP Disclaimer content is now largely resolved:** use the §2 Inkweave notice as the canonical disclaimer (footer + dedicated `/disclaimer` page), pending a confirm-against-the-PDF check. This downgrades the earlier "exact wording must be authored from scratch" blocker.
- **Terms of Use gains a hard requirement:** state the non-commercial / free-access constraint from the Community Code.
- **Footer has a concrete design target** (the duels.ink two-line pattern), reducing the open design surface.
- **Still open:** a real contact address (was already decision #4), confirming current Community Code wording/prominence against the source PDF, and the footer-scope decision (#9).

## Sources
- [Disney Lorcana Community Code (Ravensburger CDN, effective 2023-05-10)](https://cdn.ravensburger.com/lorcana/community-code-en)
- [Disney Lorcana Resources page](https://www.disneylorcana.com/en-US/resources)
- duels.ink footer (user-provided screenshot, 2026-07-09)
