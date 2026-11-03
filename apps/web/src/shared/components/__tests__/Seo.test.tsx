import {afterEach, describe, it, expect} from 'vitest';
import {cleanup, render} from '@testing-library/react';
import {Seo} from '../Seo';

afterEach(cleanup);

function breadcrumbScripts() {
  return [...document.querySelectorAll('script[type="application/ld+json"]')];
}

describe('Seo breadcrumbs', () => {
  it('renders one BreadcrumbList with positions, names and absolute URLs', () => {
    render(
      <Seo
        title="Amber Cards"
        canonicalPath="/ink/amber"
        breadcrumbs={[
          {name: 'Home', path: '/'},
          {name: 'Inks', path: '/inks'},
          {name: 'Amber', path: '/ink/amber'},
        ]}
      />,
    );
    const scripts = breadcrumbScripts();
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {'@type': 'ListItem', position: 1, name: 'Home', item: 'https://inkweave.ink/'},
        {'@type': 'ListItem', position: 2, name: 'Inks', item: 'https://inkweave.ink/inks'},
        {'@type': 'ListItem', position: 3, name: 'Amber', item: 'https://inkweave.ink/ink/amber'},
      ],
    });
  });

  it('escapes < so a name cannot close the script', () => {
    render(<Seo title="x" canonicalPath="/x" breadcrumbs={[{name: '</script><b>', path: '/x'}]} />);
    const [script] = breadcrumbScripts();
    expect(script.innerHTML).not.toContain('</script>');
    expect(JSON.parse(script.textContent ?? '').itemListElement[0].name).toBe('</script><b>');
  });

  it('renders no structured data without breadcrumbs', () => {
    render(<Seo title="x" canonicalPath="/x" />);
    expect(breadcrumbScripts()).toHaveLength(0);
  });
});
