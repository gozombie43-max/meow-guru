import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import SelectionPopover from './SelectionPopover';

function Filters({ changed = () => {} }: { changed?: (value: string) => void }) {
  const [year, setYear] = useState('2025');
  return <><SelectionPopover /><form aria-label="Filters">
    <label>Year<select name="year" value={year} onChange={event => { setYear(event.target.value); changed(event.target.value); }}>
      <option value="">All years</option><option value="2025">2025</option><option value="2024">2024</option>
      <option disabled value="2023">2023</option>
      <optgroup label="Unavailable" disabled><option value="2022">2022</option></optgroup>
    </select></label>
    <label>Tier<select name="tier" defaultValue="1"><option value="1">Tier I</option><option value="2">Tier II</option></select></label>
    <button type="button">Next</button>
  </form></>;
}

it('uses a small listbox and preserves React change handlers and form values', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<Filters changed={changed} />);
  const select = screen.getByRole('combobox', { name: 'Year' });
  await user.click(select);
  const list = screen.getByRole('listbox', { name: 'Year' });
  expect(list).toHaveFocus();
  expect(within(list).getByRole('option', { name: '2025' })).toHaveAttribute('aria-selected', 'true');
  await user.click(within(list).getByRole('option', { name: '2024' }));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(select).toHaveValue('2024');
  expect(changed).toHaveBeenCalledExactlyOnceWith('2024');
  expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('year')).toBe('2024');
  expect(select).toHaveFocus();
});

it('supports keyboard navigation, typeahead, Escape and Tab with disabled choices skipped', async () => {
  const user = userEvent.setup();
  render(<Filters />);
  const select = screen.getByRole('combobox', { name: 'Year' });
  select.focus();
  await user.keyboard('{ArrowDown}{End}{Enter}');
  expect(select).toHaveValue('2024');
  await user.keyboard(' {Home}{Escape}');
  expect(select).toHaveValue('2024');
  expect(select).toHaveFocus();
  await user.keyboard(' All{Enter}');
  expect(select).toHaveValue('');
  await user.keyboard(' {Tab}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Tier' })).toHaveFocus();
});

it('ignores disabled choices, closes outside, and switches between controls', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<Filters changed={changed} />);
  await user.click(screen.getByRole('combobox', { name: 'Year' }));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '2023' }));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '2022' }));
  expect(changed).not.toHaveBeenCalled();
  await user.click(screen.getByRole('combobox', { name: 'Tier' }));
  expect(screen.getByRole('listbox', { name: 'Tier' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
});

it('retains native multiple/list selections and disabled controls', async () => {
  const user = userEvent.setup();
  render(<><SelectionPopover /><select aria-label="Disabled" disabled><option>A</option></select>
    <select multiple aria-label="Multiple"><option>A</option><option>B</option></select>
    <select size={3} aria-label="List"><option>A</option><option>B</option></select></>);
  await user.click(screen.getByLabelText('Disabled'));
  await user.click(screen.getByLabelText('Multiple'));
  await user.click(screen.getByLabelText('List'));
  expect(document.querySelector('.selection-popover')).toBeNull();
});

it('keeps selections inside their parent dialog and restores trigger ARIA after closing', async () => {
  const user = userEvent.setup();
  render(<><SelectionPopover /><div role="dialog" aria-label="Edit paper"><label>Language
    <select aria-controls="existing" defaultValue="en"><option value="en">English</option><option value="bn">Bangla</option></select>
  </label></div></>);
  const select = screen.getByRole('combobox', { name: 'Language' });
  await user.click(select);
  expect(within(screen.getByRole('dialog')).getByRole('listbox')).toBeInTheDocument();
  expect(select).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  expect(select).not.toHaveAttribute('aria-expanded');
  expect(select).toHaveAttribute('aria-controls', 'existing');
});
