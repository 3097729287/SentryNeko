/** Segmented switch whose highlight slides to the chosen option. */

import { useLayoutEffect, useRef, useState } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  /** Already translated copy. */
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Renders the options in one track and keeps the highlight under the active one. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Stays null until the first measurement, so the highlight is never painted at a default
  // position and animated into place on mount.
  const [highlight, setHighlight] = useState<{
    height: number;
    left: number;
    top: number;
    width: number;
  } | null>(null);

  // Measured from the boxes, so padding and border of the track cannot offset the highlight.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector<HTMLElement>('[aria-pressed="true"]');

    if (!track || !active) {
      return;
    }

    const trackBox = track.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    const next = {
      height: activeBox.height,
      left: activeBox.left - trackBox.left - track.clientLeft,
      top: activeBox.top - trackBox.top - track.clientTop,
      width: activeBox.width,
    };

    setHighlight((current) =>
      current &&
      current.left === next.left &&
      current.top === next.top &&
      current.width === next.width &&
      current.height === next.height
        ? current
        : next,
    );
  });

  return (
    <div aria-label={label} className="segmented" ref={trackRef} role="group">
      {highlight ? (
        <span
          aria-hidden="true"
          className="segmented-indicator"
          style={{
            height: highlight.height,
            transform: `translate(${highlight.left}px, ${highlight.top}px)`,
            width: highlight.width,
          }}
        />
      ) : null}
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="segmented-option"
          key={option.value}
          onClick={() => {
            onChange(option.value);
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
