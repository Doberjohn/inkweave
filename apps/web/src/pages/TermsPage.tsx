import {Link} from 'react-router-dom';
import {LegalPage, legalH2Style, legalLinkStyle} from '../shared/components';
import {COLORS} from '../shared/constants';

const EMAIL = 'support.inkweave@gmail.com';

export function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p style={{marginTop: 0, color: COLORS.textMuted}}>Last updated: 9 July 2026</p>

      <p>
        By using Inkweave, you agree to these terms. Inkweave is a free, unofficial fan project for Disney
        Lorcana that I run.
      </p>

      <h2 style={legalH2Style}>Free to use</h2>
      <p>
        Inkweave is free. In line with Ravensburger&rsquo;s Community Code, I don&rsquo;t charge for access to
        the card content and won&rsquo;t put it behind payment.
      </p>

      <h2 style={legalH2Style}>Acceptable use</h2>
      <p>
        Please use Inkweave fairly: vote and use the other features in good faith; don&rsquo;t try to disrupt,
        overload, abuse, or gain unauthorized access to the service; and don&rsquo;t scrape, mass-download, or
        run automated traffic against the site. Be respectful of other players, in line with Disney
        Lorcana&rsquo;s Community Code.
      </p>

      <h2 style={legalH2Style}>Community voting</h2>
      <p>
        Votes you submit are anonymous and become part of the aggregated synergy scores everyone sees. I may
        remove or discount votes that look abusive or automated so the scores stay meaningful.
      </p>

      <h2 style={legalH2Style}>Intellectual property</h2>
      <p>
        Disney Lorcana card names, images, and text belong to their respective owners; see my{' '}
        <Link to="/disclaimer" style={legalLinkStyle}>
          Intellectual Property Disclaimer
        </Link>{' '}
        for the full notice. The synergy analysis, site design, and original text of Inkweave are mine.
      </p>

      <h2 style={legalH2Style}>No warranty</h2>
      <p>
        Inkweave is provided &ldquo;as is&rdquo;, without warranty of any kind. Synergy scores are heuristic
        and community-driven, and may be incomplete or wrong. Inkweave isn&rsquo;t an official rules source, so
        always check official sources for rulings.
      </p>

      <h2 style={legalH2Style}>Limitation of liability</h2>
      <p>
        To the maximum extent allowed by law, I&rsquo;m not liable for any loss or damage arising from your use
        of Inkweave. You use it at your own risk.
      </p>

      <h2 style={legalH2Style}>Changes</h2>
      <p>I may update these terms; continuing to use Inkweave after a change means you accept the update.</p>

      <h2 style={legalH2Style}>Governing law</h2>
      <p>These terms are governed by the laws of Greece.</p>

      <h2 style={legalH2Style}>Contact</h2>
      <p>
        <a href={`mailto:${EMAIL}`} style={legalLinkStyle}>
          {EMAIL}
        </a>
      </p>
    </LegalPage>
  );
}
