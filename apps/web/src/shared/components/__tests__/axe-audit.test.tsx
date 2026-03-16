import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import {axe} from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import {Chip} from '../Chip';
import {StrengthBadge} from '../StrengthBadge';
import {TierCircle} from '../TierCircle';
import {Callout} from '../Callout';
import {BackLink} from '../BackLink';
import {EmptyState} from '../EmptyState';
import {CtaButton} from '../CtaButton';

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

  it('Callout has no violations', async () => {
    const {container} = render(<Callout>Description text here</Callout>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('BackLink has no violations', async () => {
    const {container} = render(<BackLink onClick={() => {}} label="Back to synergies" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('EmptyState has no violations', async () => {
    const {container} = render(<EmptyState message="No results" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('CtaButton has no violations', async () => {
    const {container} = render(<CtaButton>Browse all cards</CtaButton>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
