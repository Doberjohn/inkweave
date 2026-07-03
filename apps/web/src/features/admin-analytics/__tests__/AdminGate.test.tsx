import {afterEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import {AdminGate} from '../AdminGate';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/admin/analytics']}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route
          path="/admin/analytics"
          element={
            <AdminGate>
              <div>admin content</div>
            </AdminGate>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('AdminGate', () => {
  it('renders children when the flag is "true"', () => {
    vi.stubEnv('VITE_SHOW_ADMIN_ANALYTICS', 'true');
    renderAt();
    expect(screen.getByText('admin content')).toBeInTheDocument();
  });

  it('redirects home when the flag is unset/false', () => {
    vi.stubEnv('VITE_SHOW_ADMIN_ANALYTICS', 'false');
    renderAt();
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });
});
