'use client';

import { useId, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertDialog as PrimitiveAlertDialog,
  BottomSheet as PrimitiveBottomSheet,
  Dialog as PrimitiveDialog,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import styles from './Dialog.module.css';

export type DialogSize = 'sm' | 'md' | 'lg';
export type ConfirmTone = 'primary' | 'destructive';

export interface BaseDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  closeLabel?: string;
  initialFocus?: string;
  ariaLabel?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  'data-testid'?: string;
}

export type ModalDialogProps = BaseDialogProps;
export type BottomSheetProps = BaseDialogProps;

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  size?: DialogSize;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  closeLabel?: string;
  initialFocus?: string;
  className?: string;
  'data-testid'?: string;
}

const emptySubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

interface DialogShellProps extends BaseDialogProps {
  kind: 'dialog' | 'sheet' | 'confirm';
  compactBody?: boolean;
}

function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy = false,
  closeOnBackdrop = true,
  showCloseButton = true,
  closeLabel = 'Close dialog',
  initialFocus,
  ariaLabel,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  kind,
  compactBody = false,
  'data-testid': testId,
}: DialogShellProps) {
  const hydrated = useHydrated();
  const titleId = useId();
  const descriptionId = useId();

  if (!open || !hydrated) {
    return null;
  }

  const SurfaceComponent =
    kind === 'sheet'
      ? PrimitiveBottomSheet
      : kind === 'confirm'
        ? PrimitiveAlertDialog
        : PrimitiveDialog;

  const hasDescription = description !== undefined && description !== null && description !== false;
  const hasTitle = title !== undefined && title !== null && title !== false;

  const handleBackdropClick = () => {
    if (!busy && closeOnBackdrop) {
      onClose();
    }
  };

  return createPortal(
    <>
      <div
        className={styles.backdrop}
        data-dialog-backdrop=""
        data-ui-interaction="none"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      <SurfaceComponent
        onClose={onClose}
        busy={busy}
        initialFocus={initialFocus}
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-describedby={hasDescription ? descriptionId : undefined}
        aria-label={!hasTitle ? ariaLabel : undefined}
        data-meow-dialog=""
        data-meow-kind={kind}
        data-testid={testId}
        className={cn(
          styles.dialog,
          SIZE_CLASSES[size],
          kind === 'sheet' && styles.sheet,
          className,
        )}
      >
        {kind === 'sheet' ? (
          <div className={styles.handleRow} aria-hidden="true">
            <span className={styles.handle} />
          </div>
        ) : null}

        <header className={cn(styles.header, headerClassName)}>
          <div className={styles.headerText}>
            {hasTitle ? (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            ) : null}
            {hasDescription ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>

          {showCloseButton ? (
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              onClick={onClose}
              aria-label={closeLabel}
              className={styles.closeButton}
            >
              <CloseIcon />
            </Button>
          ) : null}
        </header>

        {children !== undefined && children !== null && children !== false ? (
          <div className={cn(styles.body, compactBody && styles.bodyCompact, bodyClassName)}>
            {children}
          </div>
        ) : null}

        {footer !== undefined && footer !== null && footer !== false ? (
          <footer className={cn(styles.footer, footerClassName)}>{footer}</footer>
        ) : null}
      </SurfaceComponent>
    </>,
    document.body,
  );
}

/**
 * Canonical centered modal overlay backed by `components/ui/Dialog.tsx`.
 * Preserves global Escape/back-layer dismissal, focus trap, inert siblings, and opener restoration.
 */
export function ModalDialog(props: ModalDialogProps) {
  return <DialogShell {...props} kind="dialog" />;
}

/**
 * Responsive dialog that docks as a mobile bottom sheet (`<= 767px`, max-height `85dvh`)
 * and presents as a centered modal on tablet and desktop viewports.
 */
export function BottomSheet(props: BottomSheetProps) {
  return <DialogShell {...props} kind="sheet" />;
}

/**
 * Standardized `alertdialog` confirmation overlay with primary or destructive actions.
 * Defaults initial focus to the cancel button on destructive confirmations.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  size = 'sm',
  closeOnBackdrop = true,
  showCloseButton = false,
  closeLabel = 'Close confirmation dialog',
  initialFocus,
  className,
  'data-testid': testId,
}: ConfirmDialogProps) {
  const safeInitialFocus =
    initialFocus ?? (tone === 'destructive' ? '[data-meow-dialog-cancel="true"]' : undefined);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      busy={loading}
      closeOnBackdrop={closeOnBackdrop}
      showCloseButton={showCloseButton}
      closeLabel={closeLabel}
      initialFocus={safeInitialFocus}
      kind="confirm"
      compactBody
      className={className}
      footerClassName={styles.confirmFooter}
      data-testid={testId}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={loading}
            onClick={onClose}
            data-meow-dialog-cancel="true"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            destructiveTone={tone === 'destructive' ? 'solid' : undefined}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </DialogShell>
  );
}
