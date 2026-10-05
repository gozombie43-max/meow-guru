'use client';

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import { ArrowUp, Plus, Sparkles } from 'lucide-react';

export type TutorComposerHandle = { clear: () => void; getDraft: () => string };
type Content = {
  placeholder: string;
  quickPrompts: string;
  landingOptions: Array<{ title: string; prompt: string; tone: string }>;
};
type Props = {
  ref: Ref<TutorComposerHandle>;
  initialDraft: string;
  isLoading: boolean;
  currentContent: Content;
  isAddMenuOpen: boolean;
  setIsAddMenuOpen: (open: boolean | ((previous: boolean) => boolean)) => void;
  addMenuRef: RefObject<HTMLDivElement | null>;
  addButtonRef: RefObject<HTMLButtonElement | null>;
  iconsByTone: Record<string, ReactNode>;
  onSend: (text: string) => void;
};

export function TutorComposer({ ref, initialDraft, isLoading, currentContent, isAddMenuOpen, setIsAddMenuOpen, addMenuRef, addButtonRef, iconsByTone, onSend }: Props) {
  const [input, setInput] = useState(initialDraft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInput = input.trim().length > 0;
  useImperativeHandle(ref, () => ({ clear: () => setInput(''), getDraft: () => input }), [input]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 26), 120)}px`;
    }
  }, [input]);
  const handleSend = () => {
    if (hasInput && !isLoading) onSend(input);
  };

  return (
    <div className="tutor-composer-card">
      {isAddMenuOpen && (
        <div className="tutor-quick-menu" ref={addMenuRef}>
          <div className="tutor-menu-header">{currentContent.quickPrompts}</div>
          {currentContent.landingOptions.map(option => (
            <button data-ui-button="state" key={option.title} type="button" className="tutor-menu-item"
              onClick={() => { setIsAddMenuOpen(false); onSend(option.prompt); }} disabled={isLoading}>
              <span className="tutor-menu-icon">{iconsByTone[option.tone] || <Sparkles className="w-5 h-5 shrink-0" />}</span>
              <span className="tutor-menu-text">{option.title}</span>
            </button>
          ))}
        </div>
      )}
      <div className="tutor-input-bar">
        <button data-ui-button="state" ref={addButtonRef} type="button"
          className={`tutor-plus-btn${isAddMenuOpen ? ' active' : ''}`}
          onClick={() => setIsAddMenuOpen(previous => !previous)}
          aria-expanded={isAddMenuOpen} aria-label="Quick prompts" title="Quick prompts">
          <Plus className="w-4 h-4" strokeWidth={2.2} />
        </button>
        <div className="tutor-input-capsule">
          <textarea ref={textareaRef} className="tutor-textarea" value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={currentContent.placeholder} rows={1} disabled={isLoading} aria-label={currentContent.placeholder} />
          <button data-ui-button="state" type="button"
            className={`tutor-send-btn${hasInput && !isLoading ? ' ready' : ''}`}
            onClick={handleSend} aria-label="Send message" disabled={isLoading || !hasInput}>
            <ArrowUp className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
