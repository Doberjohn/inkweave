import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardDataProvider} from '../../../shared/contexts/CardDataContext';
import {SessionProvider} from '../../../shared/contexts/SessionContext';
import {DeckProvider} from '../state';
import {SaveDeckDialog} from './SaveDeckDialog';

/**
 * Wrapped in the REAL providers, following the SignInDialog precedent. DeckProvider
 * needs both of the others above it: `getCardById` for the derived inks, and the
 * session for the first-sign-in draft migration.
 *
 * ONLY THE SIGNED-OUT FACE IS REACHABLE HERE, and that is a property of Storybook,
 * not an omission. A signed-in session cannot exist on this origin: SessionProvider
 * reads its user from Supabase, which has no session in Storybook (and reports
 * `enabled: false` outright wherever the env is unset). The signed-in form, its
 * in-flight state and its failure state therefore have no honest story — the only
 * way to show them would be a hand-built fake session, which would be a picture of
 * the mock rather than of the component. The running app is their review surface,
 * as it already is for CompactHeader's auth control.
 */
const meta: Meta<typeof SaveDeckDialog> = {
  title: 'Deck/SaveDeckDialog',
  component: SaveDeckDialog,
  decorators: [
    (Story) => (
      <SessionProvider>
        <CardDataProvider>
          <DeckProvider>
            <Story />
          </DeckProvider>
        </CardDataProvider>
      </SessionProvider>
    ),
  ],
  tags: ['autodocs'],
  args: {isOpen: true, onClose: fn(), onSignIn: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The conversion point: a guest pressing Save gets the offer, not a locked form. */
export const SignedOut: Story = {};

export const Closed: Story = {args: {isOpen: false}};
