'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './Card.module.css';

export type CardVariant = 'default' | 'subtle' | 'interactive' | 'accent-outline';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardContainerTag = 'div' | 'section' | 'article' | 'aside' | 'li' | 'header' | 'footer';

type BaseCardProps = {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children?: ReactNode;
};

type StaticCardProps = BaseCardProps &
  Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'children' | 'className'> & {
    as?: CardContainerTag;
    onClick?: never;
  };

type InteractiveCardProps = BaseCardProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'type'> & {
    as?: 'button';
    onClick: MouseEventHandler<HTMLButtonElement>;
  };

export type CardProps = StaticCardProps | InteractiveCardProps;

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: styles.variantDefault,
  subtle: styles.variantSubtle,
  interactive: styles.variantInteractive,
  'accent-outline': styles.variantAccentOutline,
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: styles.paddingNone,
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg,
};

function isInteractiveProps(props: CardProps): props is InteractiveCardProps {
  return props.as === 'button' || typeof props.onClick === 'function';
}

/**
 * Canonical Meow container card primitive.
 * Flat surface elevation backed by `--meow-surface` + `1px solid var(--meow-border)`
 * with zero glass blur or shadow glow. Interactive cards render a native `<button>`.
 */
export function Card(props: CardProps) {
  const {
    variant = 'default',
    padding = 'md',
    className,
    children,
  } = props;

  if (isInteractiveProps(props)) {
    const { as: _as, variant: _variant, padding: _padding, className: _c, children: _ch, ...btnRest } = props;
    const resolvedVariant = variant === 'default' ? 'interactive' : variant;
    return (
      <button
        {...btnRest}
        type="button"
        data-ui-button="state"
        data-custom-focus="true"
        data-meow-component="card"
        data-meow-variant={resolvedVariant}
        data-meow-padding={padding}
        data-meow-motion="card"
        className={cn(
          styles.card,
          styles.interactiveButton,
          VARIANT_CLASSES[resolvedVariant],
          PADDING_CLASSES[padding],
          className,
        )}
      >
        {children}
      </button>
    );
  }

  const { as: Tag = 'div', variant: _variant, padding: _padding, className: _c, children: _ch, ...rest } =
    props as StaticCardProps;

  return (
    <Tag
      {...rest}
      data-meow-component="card"
      data-meow-variant={variant}
      data-meow-padding={padding}
      className={cn(styles.card, VARIANT_CLASSES[variant], PADDING_CLASSES[padding], className)}
    >
      {children}
    </Tag>
  );
}
