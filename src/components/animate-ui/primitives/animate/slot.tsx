'use client';

import * as React from 'react';
import { motion, isMotionComponent, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

type AnyProps = Record<string, unknown>;

type DOMMotionProps<_T extends HTMLElement = HTMLElement> = Omit<
  HTMLMotionProps<keyof HTMLElementTagNameMap>,
  'ref'
>;

type WithAsChild<Base extends object> =
  | (Base & { asChild: true; children: React.ReactElement })
  | (Base & { asChild?: false | undefined });

type SlotProps<T extends HTMLElement = HTMLElement> = {
  children?: React.ReactElement;
} & DOMMotionProps<T>;

function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    });
  };
}

function mergeProps<T extends HTMLElement>(
  childProps: AnyProps,
  slotProps: DOMMotionProps<T>,
): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps };

  if (childProps.className || slotProps.className) {
    merged.className = cn(
      childProps.className as string,
      slotProps.className as string,
    );
  }

  if (childProps.style || slotProps.style) {
    merged.style = {
      ...(childProps.style as React.CSSProperties),
      ...(slotProps.style as React.CSSProperties),
    };
  }

  return merged;
}

const Slot = React.forwardRef(function Slot<T extends HTMLElement = HTMLElement>(
  { children, ...props }: SlotProps<T>,
  ref: React.ForwardedRef<T>,
) {
  // El hook va antes de cualquier return: React exige el mismo orden en cada render.
  const childType = React.isValidElement(children) ? children.type : null;
  const isAlreadyMotion =
    typeof childType === 'object' && childType !== null && isMotionComponent(childType);

  const Base = React.useMemo(
    () =>
      childType == null
        ? null
        : isAlreadyMotion
          ? (childType as React.ElementType)
          : motion.create(childType as React.ElementType),
    [isAlreadyMotion, childType],
  );

  if (!React.isValidElement(children) || !Base) return null;

  const { ref: childRef, ...childProps } = children.props as AnyProps;
  const mergedProps = mergeProps(childProps, props);

  return (
    <Base {...mergedProps} ref={mergeRefs(childRef as React.Ref<T>, ref)} />
  );
}) as <T extends HTMLElement = HTMLElement>(
  props: SlotProps<T> & { ref?: React.ForwardedRef<T> },
) => React.ReactElement | null;

export {
  Slot,
  type SlotProps,
  type WithAsChild,
  type DOMMotionProps,
  type AnyProps,
};
