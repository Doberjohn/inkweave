import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CarriesPicker} from '../CarriesPicker';
import {createCard} from '../../../../shared/test-utils';

const cardA = createCard({id: 'a', fullName: 'Elsa - Snow Queen'});
const cardB = createCard({id: 'b', fullName: 'Anna - Princess'});

describe('CarriesPicker', () => {
  const onChange = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders three radio options', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value={null} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('shows card A full name', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value={null} onChange={onChange} />);
    expect(screen.getByText('Elsa - Snow Queen')).toBeInTheDocument();
  });

  it('shows "Both equally" option', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value={null} onChange={onChange} />);
    expect(screen.getByText('Both equally')).toBeInTheDocument();
  });

  it('shows card B full name', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value={null} onChange={onChange} />);
    expect(screen.getByText('Anna - Princess')).toBeInTheDocument();
  });

  it('clicking option calls onChange with correct value', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value={null} onChange={onChange} />);

    fireEvent.click(screen.getByText('Elsa - Snow Queen'));
    expect(onChange).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getByText('Both equally'));
    expect(onChange).toHaveBeenCalledWith('both');

    fireEvent.click(screen.getByText('Anna - Princess'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('selected option has aria-checked="true"', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value="a" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    const checked = radios.filter(r => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('Elsa - Snow Queen');
  });

  it('unselected options have aria-checked="false"', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value="both" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    const unchecked = radios.filter(r => r.getAttribute('aria-checked') === 'false');
    expect(unchecked).toHaveLength(2);
    expect(unchecked.map(r => r.textContent)).toContain('Elsa - Snow Queen');
    expect(unchecked.map(r => r.textContent)).toContain('Anna - Princess');
  });

  it('radiogroup has correct aria-label', () => {
    render(<CarriesPicker cardA={cardA} cardB={cardB} value={null} onChange={onChange} />);
    expect(
      screen.getByRole('radiogroup', {name: 'Which card carries this synergy'}),
    ).toBeInTheDocument();
  });
});
