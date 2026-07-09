import {Link} from 'react-router-dom';
import {LegalPage, legalH2Style, legalLinkStyle} from '../shared/components';

/** External link that opens in a new tab, styled like the other legal-page links. */
function ExtLink({href, children}: {href: string; children: React.ReactNode}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={legalLinkStyle}>
      {children}
    </a>
  );
}

export function AboutPage() {
  return (
    <LegalPage title="About Inkweave">
      <p style={{marginTop: 0}}>
        Hi, I&rsquo;m John, the developer behind Inkweave. I built it because I kept hitting the same wall
        while deck-building: I could see what each card did, but not how it played with the other fifty-nine.
        Card databases answer the first question. Inkweave is my attempt at the second.
      </p>
      <p>
        I&rsquo;m a card-game player who fell hard for Lorcana. It is easy to pick up but full of deep
        choices, and the synergy space is huge. Inkweave is where I try to map it.
      </p>

      <h2 style={legalH2Style}>What Inkweave is</h2>
      <p>
        A free synergy finder and deck builder for Disney Lorcana, focused on the Core format. It reads every
        card&rsquo;s text and keywords, works out which archetypes the card belongs to (ramp, discard, tribal
        packages, and more), and surfaces the pairings you might have missed. Because synergy is a matter of
        judgment, the community votes on it, so the scores reflect how the game really plays and not just an
        algorithm.
      </p>

      <h2 style={legalH2Style}>The community</h2>
      <p>
        Every synergy score is shaped by players like you. Voting is anonymous and takes seconds, and it makes
        the ratings better for everyone. The Lorcana community has been a genuinely positive, helpful crowd,
        and Inkweave is my small way of giving back to it.
      </p>

      <h2 style={legalH2Style}>Creators welcome</h2>
      <p>
        You are welcome to stream, record, and share content featuring Inkweave. If it helps you explain a
        combo or build a deck on camera, go for it. A link back is always appreciated but never required.
      </p>

      <h2 style={legalH2Style}>Support the game</h2>
      <p>
        The best way to support Lorcana is to buy physical cards and play at your local game store. You can
        find one through the official{' '}
        <ExtLink href="https://www.disneylorcana.com/en-US/locator/">Disney Lorcana Play Network locator</ExtLink>. For
        releases, news, and the official{' '}
        <ExtLink href="https://www.disneylorcana.com/en-US/resources">rules and resources</ExtLink>, visit the{' '}
        <ExtLink href="https://www.disneylorcana.com/en-US/">Disney Lorcana site</ExtLink>.
      </p>

      <h2 style={legalH2Style}>Keeping Inkweave free</h2>
      <p>
        I really want Inkweave to stay free, and I will do my best to keep it that way. There are no current
        plans to charge for anything or to ask for donations. Access to the card content will stay free to
        use.
      </p>

      <h2 style={legalH2Style}>A note on conduct</h2>
      <p>
        Please treat other players with respect and good sportsmanship, in line with Disney Lorcana&rsquo;s{' '}
        <ExtLink href="https://cdn.ravensburger.com/lorcana/community-code-en">Community Code</ExtLink>. Inkweave
        is meant to be a friendly corner of the community.
      </p>

      <h2 style={legalH2Style}>Not affiliated</h2>
      <p>
        Inkweave is not affiliated with, endorsed by, or sponsored by Disney, Ravensburger, or Lorcana. For
        the full notice, see the{' '}
        <Link to="/disclaimer" style={legalLinkStyle}>
          Intellectual Property Disclaimer
        </Link>
        .
      </p>

      <h2 style={legalH2Style}>Contact</h2>
      <p>
        Questions, feedback, or a synergy I missed? Reach me at{' '}
        <a href="mailto:support.inkweave@gmail.com" style={legalLinkStyle}>
          support.inkweave@gmail.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
