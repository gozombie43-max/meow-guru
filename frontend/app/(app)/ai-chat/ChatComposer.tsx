'use client';

import { useImperativeHandle, useState, type ChangeEvent, type Ref, type RefObject } from 'react';
import { ArrowUp, FileText, Image as ImageIcon, Mic, Plus, X } from 'lucide-react';
import NextImage from 'next/image';
import { bindStyleClasses } from '@/lib/styleClasses';
import styles from './AiChat.module.css';

const styleClasses = bindStyleClasses(styles);
export type ChatComposerHandle = { clear: () => void };

type Props = {
  ref: Ref<ChatComposerHandle>;
  isLoading: boolean;
  attachmentFile: File | null;
  attachmentPreview: string | null;
  attachmentError: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAttachmentChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: () => void;
  onPreview: () => void;
  onSend: (text: string) => void;
  onDraftPresenceChange: (present: boolean) => void;
};

export function ChatComposer({ ref, isLoading, attachmentFile, attachmentPreview, attachmentError, fileInputRef, onAttachmentChange, onRemoveAttachment, onPreview, onSend, onDraftPresenceChange }: Props) {
  const [input, setInput] = useState('');
  const hasInput = input.trim().length > 0 || Boolean(attachmentFile);
  useImperativeHandle(ref, () => ({ clear: () => { setInput(''); onDraftPresenceChange(false); } }), [onDraftPresenceChange]);
  const changeInput = (next: string) => {
    setInput(next);
    if (Boolean(next) !== Boolean(input)) onDraftPresenceChange(Boolean(next));
  };
  const handleSend = () => {
    if (hasInput && !isLoading) onSend(input);
  };
  return (
        <form
          className={styleClasses("composer-wrap")}
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <div className={styleClasses("composer")}>
            {(attachmentFile || attachmentError) && (
              <div className={styleClasses("attachment-panel")}>
                {attachmentFile && (
                  <div className={styleClasses("attachment-chip")}>
                    {attachmentPreview ? (
                      <div className={styleClasses("image-preview-wrapper")} onClick={() => onPreview()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                        <NextImage
                          className={styleClasses("attachment-thumb")}
                          src={attachmentPreview}
                          alt=""
                          width={60}
                          height={60}
                          unoptimized
                        />
                        <button data-ui-button="state" data-ui-shape="icon" type="button" className={styleClasses("remove-image-btn")} onClick={(e) => { e.stopPropagation(); onRemoveAttachment(); }} aria-label="Remove attachment">
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <div className={styleClasses("file-preview-wrapper")}>
                        <span className={styleClasses("file-icon")}>
                          {attachmentFile.type === 'application/pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                        </span>
                        <div className={styleClasses("file-info")}>
                          <strong>{attachmentFile.name}</strong>
                          <span>{attachmentFile.type === 'application/pdf' ? 'PDF document' : 'Question image'}</span>
                        </div>
                        <button data-ui-button="state" data-ui-shape="icon" type="button" className={styleClasses("remove-file-btn")} onClick={onRemoveAttachment} aria-label="Remove attachment">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {attachmentError && <div className={styleClasses("attachment-error")}>{attachmentError}</div>}
              </div>
            )}

            <div className={styleClasses("composer-row")}>
              <input
                ref={fileInputRef}
                className={styleClasses("file-input")}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={onAttachmentChange}
               aria-label="Choose file"/>
              <button data-ui-button="state" data-ui-shape="icon"
                className={styleClasses("composer-tool clip-btn")}
                type="button"
                aria-label="Attach question image or PDF"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach image or PDF"
              >
                <Plus size={22} />
              </button>
              <textarea
                data-custom-focus
                value={input}
                onChange={(event) => changeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask ChatGPT"
                rows={1}
                disabled={isLoading}
               aria-label="Ask ChatGPT"/>
              <button data-ui-button="state" data-ui-shape="icon" className={styleClasses("composer-tool mic-btn")} type="button" aria-label="Voice input">
                <Mic size={20} />
              </button>
              <button data-ui-button="primary" data-ui-shape="icon" className={styleClasses("send-btn")} type="submit" disabled={!hasInput || isLoading} aria-label="Send message">
                <ArrowUp size={20} className={styleClasses("send-icon")} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </form>
  );
}
