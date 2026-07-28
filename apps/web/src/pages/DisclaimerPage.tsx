import {LegalPage, legalLinkStyle} from '../shared/components';

export function DisclaimerPage() {
  return (
    <LegalPage title="Intellectual Property Disclaimer">
      <p style={{marginTop: 0}}>
        Inkweave uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under
        Ravensburger&rsquo;s Community Code Policy. We are expressly prohibited from charging you to use or
        access this content. Inkweave is not published, endorsed, or specifically approved by Disney or
        Ravensburger. For more information about Disney Lorcana TCG, visit{' '}
        {/* Locale-prefixed root — see the note in Footer.tsx. The bare domain 403s. */}
        <a href="https://www.disneylorcana.com/en-US/" target="_blank" rel="noreferrer" style={legalLinkStyle}>
          disneylorcana.com
        </a>
        .
      </p>
      <p>
        All card names, images, artwork, and game text are the intellectual property of Ravensburger and/or
        The Walt Disney Company. Card data is provided by the community project{' '}
        <a href="https://lorcanajson.org" target="_blank" rel="noreferrer" style={legalLinkStyle}>
          LorcanaJSON
        </a>
        .
      </p>
      <p>
        Inkweave is an independent, unofficial fan project. It is not affiliated with, endorsed by, or
        sponsored by Disney, Ravensburger, or Lorcana.
      </p>
    </LegalPage>
  );
}
