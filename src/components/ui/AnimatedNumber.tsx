"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/** Counts smoothly between values; jumps instantly with reduced motion. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-IN"), duration = 0.8, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      const id = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(id);
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        from.current = latest;
        setDisplay(latest);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className={className ?? "tabular"}>{format(display)}</span>;
}
