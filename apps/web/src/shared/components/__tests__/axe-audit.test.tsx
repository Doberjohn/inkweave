import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import {axe} from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';

// vitest-axe ships the matcher but not its type; declare the one we use so it
// type-checks (runtime wiring is the expect.extend(matchers) call below). A
// bare `interface extends AxeMatchers {}` would trip no-empty-object-type.
// Vitest 5 reads custom matchers from Matchers<R, T>; augmenting Assertion
// directly must repeat its exact type parameters (TS2428).
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- T must be declared for the merge
  interface Matchers<R, T> {
    toHaveNoViolations(): R;
  }
}
import {Chip} from '../Chip';
import {StrengthBadge} from '../StrengthBadge';
import {TierCircle} from '../TierCircle';
import {AbilityCallout} from '../AbilityCallout';
import {AbilityTag} from '../AbilityTag';
import {BackLink} from '../BackLink';
import {EmptyState} from '../EmptyState';
import {CtaButton} from '../CtaButton';
import {DialogShell} from '../DialogShell';

expect.extend(matchers);

describe('axe accessibility audit', () => {
  it('Chip toggle variant has no violations', async () => {
    const {container} = render(<Chip label="Filter" active={false} onClick={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Chip dismiss variant has no violations', async () => {
    const {container} = render(<Chip label="Amethyst" variant="dismiss" onDismiss={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('StrengthBadge has no violations', async () => {
    const tier = {label: 'Strong' as const, shortLabel: 'Strong', color: '#6ee7a0', bg: '#1a3d1a'};
    const {container} = render(<StrengthBadge tier={tier}>Strong 7</StrengthBadge>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('TierCircle has no violations', async () => {
    const tier = {label: 'Moderate' as const, shortLabel: 'Mod', color: '#60b5f5', bg: '#10253d'};
    const {container} = render(<TierCircle tier={tier}>5</TierCircle>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('AbilityCallout has no violations', async () => {
    const {container} = render(<AbilityCallout>Description text here</AbilityCallout>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('AbilityTag has no violations', async () => {
    const {container} = render(<AbilityTag>Ramp</AbilityTag>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('BackLink has no violations', async () => {
    const {container} = render(<BackLink onClick={() => {}} label="Back to synergies" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('EmptyState has no violations', async () => {
    const {container} = render(<EmptyState title="No results" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('CtaButton has no violations', async () => {
    const {container} = render(<CtaButton>Browse all cards</CtaButton>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('DialogShell (open) has no violations', async () => {
    // Portals to document.body, so audit baseElement — `container` would be empty.
    const {baseElement} = render(
      <DialogShell isOpen onClose={() => {}} ariaLabel="Example dialog">
        <button type="button">Close</button>
      </DialogShell>,
    );
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });
});
