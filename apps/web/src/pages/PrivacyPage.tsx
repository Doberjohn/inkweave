import {LegalPage, legalH2Style, legalLinkStyle} from '../shared/components';
import {COLORS} from '../shared/constants';
import {SHOW_FRIENDS} from '../features/friends/flag';

const EMAIL = 'support.inkweave@gmail.com';

const DESCRIPTION =
  'What Inkweave collects (anonymous synergy votes, cookieless analytics and error reports), where it is stored, how long it is kept, and your rights.';

export function PrivacyPage() {
  // The friends sentence below shows only while friends is on (#852), and the date moves
  // with it, so the date always says when the text on screen last changed.
  const lastUpdated = SHOW_FRIENDS ? '21 October 2026' : '20 October 2026';
  return (
    <LegalPage title="Privacy Policy" description={DESCRIPTION}>
      <p style={{marginTop: 0, color: COLORS.textMuted}}>Last updated: {lastUpdated}</p>

      <p>
        I built Inkweave as a free fan project, and I collect as little as possible. You can browse cards,
        explore synergies, and vote with no account. I don&rsquo;t sell your data, I don&rsquo;t use tracking
        cookies, and everything I store lives in the EU or on your own device.
      </p>

      <h2 style={legalH2Style}>What I collect</h2>
      <ul style={{paddingLeft: 20, margin: 0}}>
        <li>
          <strong>When you vote on synergies.</strong> Voting is anonymous and needs no account. I store your
          vote (the two cards and your ratings) alongside a one-way hashed form of your IP address. I use that
          hash only to rate-limit voting so one person can&rsquo;t flood the results. I never store your raw IP
          address, and the hash can&rsquo;t be reversed back into it.
        </li>
        <li>
          <strong>Analytics.</strong> I use PostHog and Vercel Web Analytics to see which pages and features
          get used and how people move through the site, and Speed Insights to measure performance. None of
          them uses cookies or ties anything to an account. PostHog recognises a visit by a one-way hash of
          your IP address and browser that changes every day, and doesn&rsquo;t keep the IP address itself, so it
          can&rsquo;t follow you from one day to the next. I record the pages you open and what you click, events
          like which cards and playstyles are opened, and the text typed into the search box.
        </li>
        <li>
          <strong>Error reports.</strong> When something breaks, I use Sentry to collect a diagnostic report
          (what failed, the page, your browser) so I can fix it.
        </li>
        <li>
          <strong>On your device.</strong> Your deck drafts, the votes you&rsquo;ve already cast, and your
          recent searches are saved only in your browser and never sent to me. You can clear them any time.
        </li>
        <li>
          <strong>If you sign in (optional).</strong> Signing in with Google or Discord is only needed to save
          decks to an account. If you do, I receive basic account identity from that provider (such as your
          email and a provider id). Your session is stored in your browser, not in a cookie.
          {SHOW_FRIENDS && (
            <>
              {' '}
              Your account also gets a friend code, which I store. If you add friends, I store who your friends
              and friend requests are. Your friends see your display name and handle, which anyone can see.
            </>
          )}
        </li>
      </ul>

      <h2 style={legalH2Style}>Cookies</h2>
      <p>
        Inkweave doesn&rsquo;t set any cookies. It uses your browser&rsquo;s local storage for the things
        above, all of which are functional (they make the site work), not tracking.
      </p>

      <h2 style={legalH2Style}>Where my data lives</h2>
      <p>
        Everything I store is in the EU: votes and any account data are in Supabase (Frankfurt, Germany),
        analytics events go to PostHog&rsquo;s EU cloud (Frankfurt, Germany), and error reports go to Sentry in
        the EU. Inkweave is hosted on Vercel and served from its Frankfurt
        region. Card images and fonts come from Inkweave&rsquo;s own servers. If you sign in with Google or
        Discord, that sign-in also involves those providers under their own privacy policies.
      </p>

      <h2 style={legalH2Style}>How long I keep it</h2>
      <p>
        I keep community votes for as long as Inkweave runs; they&rsquo;re anonymous and aggregated, so
        there&rsquo;s no reliable way to tie them to a person. If you have an account, I keep it until you ask
        me to delete it.
      </p>

      <h2 style={legalH2Style}>Your rights</h2>
      <p>
        You can use almost all of Inkweave with no account, and clear your browser data any time. Under GDPR
        you can ask me for a copy of your account data or to delete it; because votes are anonymous, I
        can&rsquo;t single out one person&rsquo;s votes. To make a request, email me at{' '}
        <a href={`mailto:${EMAIL}`} style={legalLinkStyle}>
          {EMAIL}
        </a>
        . If you&rsquo;re in the EU, you also have the right to complain to your data protection authority (in
        Greece, the Hellenic Data Protection Authority).
      </p>

      <h2 style={legalH2Style}>Who I share data with</h2>
      <p>
        I don&rsquo;t sell your data. I rely on a few providers to run Inkweave: Vercel (hosting and
        analytics), PostHog (analytics), Supabase (database and sign-in), Sentry (error reports), and Google or
        Discord (only if you choose to sign in). That&rsquo;s it.
      </p>

      <h2 style={legalH2Style}>Changes</h2>
      <p>I may update this policy; the date at the top shows when it last changed.</p>

      <h2 style={legalH2Style}>Contact</h2>
      <p>
        <a href={`mailto:${EMAIL}`} style={legalLinkStyle}>
          {EMAIL}
        </a>
      </p>
    </LegalPage>
  );
}
