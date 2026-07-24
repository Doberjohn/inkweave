import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import type {HealthAnalyzer} from '../types';
import {HealthGlance} from './HealthGlance';

const an = (id: string, label: string, status: HealthAnalyzer['status'], message: string): HealthAnalyzer => ({
  id,
  label,
  status,
  message,
  score: status === 'bad' ? 20 : 80,
});

describe('HealthGlance', () => {
  it('renders a labeled dot per analyzer', () => {
    render(<HealthGlance analyzers={[an('curve', 'Curve', 'good', 'ok'), an('removal', 'Removal', 'bad', 'Only 4 removal cards')]} vulnerabilities={[]} />);
    expect(screen.getByText('Curve')).toBeInTheDocument();
    expect(screen.getByText('Removal')).toBeInTheDocument();
  });

  it('calls out the worst analyzer message', () => {
    render(<HealthGlance analyzers={[an('curve', 'Curve', 'good', 'ok'), an('removal', 'Removal', 'bad', 'Only 4 removal cards')]} vulnerabilities={[]} />);
    expect(screen.getByText('Only 4 removal cards')).toBeInTheDocument();
  });

  it('shows no callout when every dimension is healthy', () => {
    render(<HealthGlance analyzers={[an('curve', 'Curve', 'good', 'ok')]} vulnerabilities={[]} />);
    expect(screen.queryByText('ok')).not.toBeInTheDocument();
  });
});
