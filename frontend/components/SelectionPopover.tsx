'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import './selection-popover.css';

type Choice = { index: number; label: string; disabled: boolean; group: string };

function choicesFor(select: HTMLSelectElement): Choice[] {
  return Array.from(select.options).flatMap((option, index) => {
    const group = option.parentElement;
    if (option.hidden || group?.hidden) return [];
    return [{ index, label: option.label, disabled: option.disabled || (group instanceof HTMLOptGroupElement && group.disabled),
      group: group instanceof HTMLOptGroupElement ? group.label : '' }];
  });
}

/** Enhances single native selects without changing route-owned form handlers. */
export default function SelectionPopover() {
  const [select, setSelect] = useState<HTMLSelectElement | null>(null);
  const current = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const targetSelect = (target: EventTarget | null) => target instanceof HTMLSelectElement
      && !target.disabled && !target.multiple && target.size <= 1 ? target : null;
    const open = (target: HTMLSelectElement) => {
      current.current = target;
      setSelect(target);
    };
    const pointer = (event: PointerEvent) => {
      const target = targetSelect(event.target);
      if (!target || event.button !== 0) return;
      event.preventDefault();
      if (current.current === target) {
        current.current = null;
        setSelect(null);
      } else open(target);
    };
    const click = (event: MouseEvent) => {
      const target = targetSelect(event.target);
      if (!target) return;
      event.preventDefault();
      // Keyboard/assistive clicks do not necessarily have a preceding pointer event.
      if (event.detail === 0) open(target);
    };
    const key = (event: KeyboardEvent) => {
      const target = targetSelect(event.target);
      if (!target || !['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      open(target);
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
    };
  }, []);

  if (!select) return null;
  return createPortal(<SelectionMenu key={Array.from(document.querySelectorAll('select')).indexOf(select)} select={select} onClose={(restoreFocus) => {
    current.current = null;
    setSelect(null);
    if (restoreFocus && select.isConnected) select.focus({ preventScroll: true });
  }} />, select.closest('dialog, [role="dialog"], [aria-modal="true"]') || document.body);
}

function SelectionMenu({ select, onClose }: { select: HTMLSelectElement; onClose: (restoreFocus: boolean) => void }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const choices = choicesFor(select);
  const [active, setActive] = useState(() => choices.find(choice => choice.index === select.selectedIndex && !choice.disabled)?.index
    ?? choices.find(choice => !choice.disabled)?.index ?? -1);
  const typeahead = useRef({ value: '', at: 0 });
  const labelledBy = select.getAttribute('aria-labelledby');
  const label = select.getAttribute('aria-label') || Array.from(select.labels || []).map(item => {
    const copy = item.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('select').forEach(node => node.remove());
    return copy.textContent?.trim();
  }).join(' ')
    || select.name || 'Select option';

  useLayoutEffect(() => {
    const node = menu.current;
    if (!node) return;
    const rect = select.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const available = Math.max(80, height - 24);
    const below = top + height - rect.bottom - 8;
    const above = rect.top - top - 8;
    const placeBelow = below >= Math.min(240, available) || below >= above;
    node.style.width = `${Math.min(Math.max(rect.width, 160), 280, width - 24)}px`;
    node.style.maxHeight = `${Math.min(280, available, Math.max(placeBelow ? below : above, 80))}px`;
    node.style.left = `${Math.max(left + 12, Math.min(rect.right - parseFloat(node.style.width), left + width - parseFloat(node.style.width) - 12))}px`;
    const themeOwner = select.closest('[data-theme], .theme-light, .theme-dark, .training-dark');
    node.dataset.theme = themeOwner?.classList.contains('theme-light') || themeOwner?.getAttribute('data-theme') === 'light' ? 'light' :
      themeOwner?.classList.contains('theme-dark') || themeOwner?.classList.contains('training-dark') || themeOwner?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    node.showPopover?.();
    const menuHeight = node.getBoundingClientRect().height;
    node.style.top = `${Math.max(top + 12, Math.min(placeBelow ? rect.bottom + 6 : rect.top - menuHeight - 6, top + height - menuHeight - 12))}px`;
    const expanded = select.getAttribute('aria-expanded');
    const controls = select.getAttribute('aria-controls');
    select.setAttribute('aria-expanded', 'true');
    select.setAttribute('aria-controls', id);
    list.current?.focus({ preventScroll: true });
    return () => {
      node.hidePopover?.();
      if (expanded === null) select.removeAttribute('aria-expanded'); else select.setAttribute('aria-expanded', expanded);
      if (controls === null) select.removeAttribute('aria-controls'); else select.setAttribute('aria-controls', controls);
    };
  }, [select, id]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof HTMLSelectElement && !event.target.disabled && !event.target.multiple && event.target.size <= 1) return;
      if (event.target instanceof Node && !menu.current?.contains(event.target) && event.target !== select) onClose(false);
    };
    const moved = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      onClose(false);
    };
    // Route transitions or dependent-field updates can remove/disable the trigger.
    const observer = new MutationObserver(() => {
      if (!select.isConnected || select.disabled) onClose(false);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', moved, true);
    window.addEventListener('resize', moved);
    window.visualViewport?.addEventListener('resize', moved);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', moved);
      window.visualViewport?.removeEventListener('resize', moved);
    };
  }, [select, onClose]);

  const choose = (index: number) => {
    const option = select.options[index];
    if (!option || option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled)
      || select.disabled || !select.isConnected) return;
    if (select.selectedIndex !== index) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex')?.set?.call(select, index);
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    onClose(true);
  };

  return <div ref={menu} className="selection-popover" popover={'showPopover' in HTMLElement.prototype ? 'manual' : undefined} data-custom-focus>
    <div ref={list} id={id} className="selection-popover-list" role="listbox" tabIndex={-1}
      aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy || undefined}
      aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      onKeyDown={event => {
        const enabled = choices.filter(choice => !choice.disabled);
        const position = enabled.findIndex(choice => choice.index === active);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
            (position + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
          setActive(enabled[next]?.index ?? -1);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation(); choose(active);
        } else if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
          onClose(true);
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          typeahead.current = { value: (now - typeahead.current.at < 600 ? typeahead.current.value : '') + event.key.toLocaleLowerCase(), at: now };
          const match = enabled.find(choice => choice.label.toLocaleLowerCase().startsWith(typeahead.current.value));
          if (match) setActive(match.index);
        }
      }}>
      {choices.map((choice, position) => <div key={choice.index}>
        {choice.group && choice.group !== choices[position - 1]?.group && <div className="selection-popover-group">{choice.group}</div>}
        <div id={`${id}-${choice.index}`} role="option" aria-selected={choice.index === select.selectedIndex}
          aria-disabled={choice.disabled || undefined} data-option-index={choice.index} data-active={choice.index === active}
          className="selection-popover-option" tabIndex={-1} onPointerMove={() => { if (!choice.disabled) setActive(choice.index); }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault(); event.stopPropagation();
              if (!choice.disabled) choose(choice.index);
            }
          }}
          onClick={() => { if (!choice.disabled) choose(choice.index); }}>
          <span>{choice.label}</span>{choice.index === select.selectedIndex && <Check size={14} aria-hidden="true" />}
        </div>
      </div>)}
      {choices.length === 0 && <div className="selection-popover-empty">No options available</div>}
    </div>
  </div>;
}
