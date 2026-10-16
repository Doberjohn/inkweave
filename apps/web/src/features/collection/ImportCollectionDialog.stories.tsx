import type {Meta, StoryObj} from '@storybook/react-vite';
// `screen`, not `within(canvasElement)`: DialogShell portals to document.body, so
// the dialog is OUTSIDE the story canvas and a canvas-scoped query finds nothing.
import {fn, screen, userEvent} from 'storybook/test';
import {createCard} from '../../shared/test-utils';
import {ImportCollectionDialog} from './ImportCollectionDialog';

const pool = [
  createCard({id: '1', fullName: 'Angel - Experiment 624', setCode: '11', setNumber: 191}),
  createCard({id: '2', fullName: 'Nani - Stage Manager', setCode: '11', setNumber: 20}),
  createCard({id: '3', fullName: 'Bambi - Ethereal Fawn', setCode: '11', setNumber: 24}),
];

/** A Dreamborn export in miniature: two owned Core cards and one from set 4. */
const CSV = [
  'Set Number,Card Number,Variant,Count,Name,Color,Rarity',
  '011,191,normal,4,"Angel - Experiment 624",Amber,Rare',
  '011,191,foil,1,"Angel - Experiment 624",Amber,Rare',
  '011,20,normal,2,"Nani - Stage Manager",Amber,Common',
  '011,24,normal,0,"Bambi - Ethereal Fawn",Amber,Common',
  '004,101,normal,3,"An Older Card",Ruby,Common',
].join('\n');

function csvFile(): File {
  return new File([CSV], 'collection.csv', {type: 'text/csv'});
}

const meta: Meta<typeof ImportCollectionDialog> = {
  title: 'Collection/ImportCollectionDialog',
  component: ImportCollectionDialog,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onImport: fn(() => null),
    pool,
    isPoolReady: true,
    poolError: null,
    onRetryPool: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseAFile: Story = {};

/**
 * The non-Core sets load lazily, so for a moment after opening, `pool` holds
 * only the Core cards. Importing against that partial pool does not error — it
 * silently reclassifies two thirds of a real collection as "outside Core" and
 * drops it, so the picker is closed until the pool is whole.
 *
 * Note `Meta.args` is PARTIAL, so leaving `isPoolReady` unset compiles cleanly
 * and lands here by accident. That is how this state was first reached.
 */
export const PoolStillLoading: Story = {
  args: {isPoolReady: false},
};

/**
 * A set's file failed to load, so the pool will never be whole without a retry.
 * Outside collection mode the binder, which shows the same error, is not drawn, so
 * the dialog itself says so and offers Try again rather than loading forever.
 */
export const PoolFailedToLoad: Story = {
  args: {isPoolReady: false, poolError: 'Could not load the collection (HTTP 503).'},
};

/**
 * The receipt, which is always shown on success — unlike the decklist import,
 * which closes silently. Driven through a real upload because the summary is
 * internal state with no prop to set it.
 */
export const Imported: Story = {
  play: async () => {
    await userEvent.upload(screen.getByLabelText('Collection CSV file'), csvFile());
    // The read is async: the story ends on the receipt, not the chooser.
    await screen.findByRole('heading', {name: 'Collection imported'});
  },
};

/**
 * Every line the receipt can show. Set 3's Dalmatian Puppy is five printings all
 * numbered 4 in our data, where Dreamborn letters them 4a-4e, so no row can say
 * which printing it owns: those rows are left out with a reason of their own (#553),
 * apart from the set-4 row that matches nothing.
 */
export const SharedNumber: Story = {
  args: {
    pool: [
      ...pool,
      ...['436', '437'].map((id) =>
        createCard({id, fullName: 'Dalmatian Puppy - Tail Wagger', setCode: '3', setNumber: 4}),
      ),
    ],
  },
  play: async () => {
    const rows = [
      CSV,
      '003,4a,normal,2,"Dalmatian Puppy - Tail Wagger",Amber,Common',
      '003,4b,foil,1,"Dalmatian Puppy - Tail Wagger",Amber,Common',
    ].join('\n');
    await userEvent.upload(
      screen.getByLabelText('Collection CSV file'),
      new File([rows], 'collection.csv', {type: 'text/csv'}),
    );
    await screen.findByRole('heading', {name: 'Collection imported'});
  },
};

/** Storage refused the write, so the import did not happen and says so. */
export const StorageRefused: Story = {
  args: {onImport: fn(() => 'Your browser would not let us save this collection.')},
  play: async () => {
    await userEvent.upload(screen.getByLabelText('Collection CSV file'), csvFile());
    await screen.findByRole('alert');
  },
};

/** The wrong file: it parsed, but nobody owns anything in it. */
export const NothingOwned: Story = {
  play: async () => {
    const empty = new File(
      ['Set Number,Card Number,Variant,Count,Name,Color,Rarity\n011,191,normal,0,"Angel",Amber,Rare'],
      'empty.csv',
      {type: 'text/csv'},
    );
    await userEvent.upload(screen.getByLabelText('Collection CSV file'), empty);
    await screen.findByRole('alert');
  },
};
