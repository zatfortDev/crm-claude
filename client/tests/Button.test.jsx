import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router';
import { Button } from '../src/components/ui/Button.jsx';

describe('Button', () => {
  it('renderiza un botón deshabilitado mientras carga', () => {
    render(<Button loading>Guardar</Button>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('puede renderizarse como enlace con `as`', () => {
    render(
      <MemoryRouter>
        <Button as={Link} to="/dashboard">
          Ir
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Ir' })).toHaveAttribute('href', '/dashboard');
  });
});
