import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BottomSheet,
  Checkbox,
  ConfirmDialog,
  Input,
  ModalDialog,
  SearchInput,
  Select,
  Switch,
  Textarea,
} from './components';

const COMPONENT_CSS_FILES = ['Dialog.module.css', 'Form.module.css'] as const;

describe('P0-C Dialog & Overlay primitives', () => {
  it('renders ModalDialog in a portal, traps background with inert, locks scroll, and restores opener focus', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div data-testid="app-root">
          <button type="button" onClick={() => setOpen(true)}>
            Open modal
          </button>
          <ModalDialog
            open={open}
            onClose={() => setOpen(false)}
            title="Study Preferences"
            description="Update your default session rules."
            footer={<button type="button">Done</button>}
          >
            <button type="button">Inside action</button>
          </ModalDialog>
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Study Preferences' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-ui-dialog', 'true');
    expect(dialog).toHaveAccessibleDescription('Update your default session rules.');
    expect(dialog.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
    expect(Boolean((screen.getByTestId('app-root').parentElement as HTMLElement).inert)).toBe(true);

    const backdrop = document.body.querySelector('[data-dialog-backdrop]');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute('data-ui-interaction', 'none');

    // Escape key closes via global navigationController layer
    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes BottomSheet via backdrop click and exposes data-ui-sheet', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet
        open
        onClose={onClose}
        title="Filter Questions"
        description="Choose subjects to include"
      >
        <p>Sheet content</p>
      </BottomSheet>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Filter Questions' });
    expect(dialog).toHaveAttribute('data-ui-sheet', 'true');

    const backdrop = document.body.querySelector('[data-dialog-backdrop]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks backdrop click, close button, and Escape while ConfirmDialog is loading', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Attempt?"
        description="This action cannot be undone."
        tone="destructive"
        confirmLabel="Delete"
        cancelLabel="Keep"
        loading
        showCloseButton
      />,
    );

    const alertDialog = screen.getByRole('alertdialog', { name: 'Delete Attempt?' });
    expect(alertDialog).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Keep' });
    const confirmBtn = screen.getByRole('button', { name: /Delete/i });
    const closeBtn = screen.getByRole('button', { name: 'Close confirmation dialog' });
    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
    expect(closeBtn).toBeDisabled();

    fireEvent.click(document.body.querySelector('[data-dialog-backdrop]') as HTMLElement);
    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('focuses cancel action by default when ConfirmDialog tone is destructive', () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Reset All Progress"
        description="This clears local history."
        tone="destructive"
        confirmLabel="Reset"
        cancelLabel="Cancel"
      />,
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('dismisses only the top-most dialog on Escape when dialogs are stacked', () => {
    function NestedDialogs() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(false);
      return (
        <ModalDialog open={outer} onClose={() => setOuter(false)} title="Outer Dialog">
          <button type="button" onClick={() => setInner(true)}>
            Open Confirm
          </button>
          <ConfirmDialog
            open={inner}
            onClose={() => setInner(false)}
            onConfirm={vi.fn()}
            title="Inner Confirm"
          />
        </ModalDialog>
      );
    }

    render(<NestedDialogs />);
    const outerDialog = screen.getByRole('dialog', { name: 'Outer Dialog' });
    expect(outerDialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Confirm' }));
    expect(screen.getByRole('alertdialog', { name: 'Inner Confirm' })).toBeInTheDocument();
    expect(outerDialog.inert).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(screen.queryByRole('alertdialog', { name: 'Inner Confirm' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Outer Dialog' })).toBeInTheDocument();
    expect(Boolean(outerDialog.inert)).toBe(false);

    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(screen.queryByRole('dialog', { name: 'Outer Dialog' })).not.toBeInTheDocument();
  });
});

describe('P0-C Form primitives', () => {
  it('wires label, error, hint, refs, and custom focus flags on Input and Textarea', () => {
    const inputRef = createRef<HTMLInputElement>();
    const textareaRef = createRef<HTMLTextAreaElement>();

    render(
      <>
        <Input
          ref={inputRef}
          label="Email address"
          placeholder="student@example.com"
          hint="Used for recovery alerts"
          error="Enter a valid email"
          required
        />
        <Textarea
          ref={textareaRef}
          label="Notes"
          hint="Optional summary"
          disabled
        />
      </>,
    );

    const input = screen.getByLabelText(/Email address/i) as HTMLInputElement;
    expect(inputRef.current).toBe(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('data-custom-focus', 'true');
    expect(input).toHaveAttribute('data-ui-interaction', 'none');
    expect(input).toHaveAccessibleDescription('Enter a valid email Used for recovery alerts');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');

    const textarea = screen.getByLabelText('Notes') as HTMLTextAreaElement;
    expect(textareaRef.current).toBe(textarea);
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAccessibleDescription('Optional summary');
  });

  it('supports controlled and uncontrolled clear behavior in SearchInput and restores focus', () => {
    const onClearUncontrolled = vi.fn();
    const onValueChange = vi.fn();

    function ControlledSearch() {
      const [query, setQuery] = useState('algebra');
      return (
        <SearchInput
          label="Search topics"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          clearLabel="Clear controlled search"
        />
      );
    }

    render(
      <>
        <SearchInput
          label="Quick filter"
          defaultValue="geometry"
          shortcutHint="Ctrl+K"
          onClear={onClearUncontrolled}
          onValueChange={onValueChange}
          clearLabel="Clear quick filter"
        />
        <ControlledSearch />
      </>,
    );

    const quickInput = screen.getByLabelText('Quick filter') as HTMLInputElement;
    expect(quickInput.value).toBe('geometry');
    fireEvent.click(screen.getByRole('button', { name: 'Clear quick filter' }));
    expect(quickInput.value).toBe('');
    expect(onClearUncontrolled).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(quickInput);
    expect(screen.queryByRole('button', { name: 'Clear quick filter' })).not.toBeInTheDocument();

    const controlledInput = screen.getByLabelText('Search topics') as HTMLInputElement;
    expect(controlledInput.value).toBe('algebra');
    fireEvent.click(screen.getByRole('button', { name: 'Clear controlled search' }));
    expect(controlledInput.value).toBe('');
    expect(document.activeElement).toBe(controlledInput);
  });

  it('renders Select with options, placeholder, and change events', () => {
    const onChange = vi.fn();
    const selectRef = createRef<HTMLSelectElement>();

    render(
      <Select
        ref={selectRef}
        label="Subject"
        placeholder="Select a subject"
        options={[
          { value: 'quant', label: 'Quantitative Aptitude' },
          { value: 'english', label: 'English Comprehension' },
        ]}
        onChange={onChange}
      />,
    );

    const select = screen.getByLabelText('Subject') as HTMLSelectElement;
    expect(selectRef.current).toBe(select);
    expect(select.value).toBe('');

    fireEvent.change(select, { target: { value: 'english' } });
    expect(select.value).toBe('english');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports native checked and indeterminate states on Checkbox', () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        label="Select all"
        description="Applies to visible rows"
        indeterminate
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /Select all/i }) as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    expect(checkbox).toHaveAccessibleDescription('Applies to visible rows');
    expect(checkbox).toHaveAttribute('data-custom-focus', 'true');

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders accessible Switch without data-ui-button override and toggles cleanly', () => {
    const onCheckedChange = vi.fn();
    const { container } = render(
      <Switch
        label="Auto-advance question"
        description="Move to next card after answering"
        defaultChecked={false}
        name="autoAdvance"
        onCheckedChange={onCheckedChange}
      />,
    );

    const switchBtn = screen.getByRole('switch', { name: 'Auto-advance question' });
    expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    expect(switchBtn).not.toHaveAttribute('data-ui-button');
    expect(switchBtn).toHaveAttribute('data-custom-focus', 'true');
    expect(switchBtn).toHaveAttribute('data-ui-interaction', 'none');
    expect(switchBtn).toHaveAccessibleDescription('Move to next card after answering');

    const hidden = container.querySelector('input[type="hidden"][name="autoAdvance"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.disabled).toBe(true);

    // Clicking label activates the associated button cleanly
    fireEvent.click(screen.getByText('Auto-advance question'));
    expect(switchBtn).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(hidden.disabled).toBe(false);
  });

  it('prevents toggling disabled Switch', () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Locked option" disabled defaultChecked onCheckedChange={onCheckedChange} />);

    const switchBtn = screen.getByRole('switch', { name: 'Locked option' });
    expect(switchBtn).toBeDisabled();
    fireEvent.click(switchBtn);
    expect(switchBtn).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe('P0-C CSS guardrail contracts', () => {
  it.each(COMPONENT_CSS_FILES)('%s obeys transition, viewport unit, mobile typography, and reduced-motion rules', (fileName) => {
    const cssPath = path.resolve(process.cwd(), 'design-system/components', fileName);
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).not.toMatch(/transition\s*:\s*all\b/i);
    expect(css).not.toMatch(/100vh\b/i);
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain("[data-meow-motion='reduced']");

    if (fileName === 'Form.module.css') {
      expect(css).toMatch(/font-size:\s*max\(16px,\s*var\(--meow-text-md\)\)/);
      expect(css).toMatch(/\.controlShell \.input::placeholder,\s*\.controlShell \.textarea::placeholder\s*\{\s*color:\s*var\(--meow-secondary\);/s);
    }
  });
});
