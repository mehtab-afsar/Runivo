import React from 'react';
import { Segmented } from '@mobile/shared/components/Segmented';

interface SegmentedProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Hug the labels (beside a row label). False: share the full width (stacked rows). */
  fit?: boolean;
}

/** Settings' string-option switch, drawn by the shared Segmented control. */
export function SegmentedControl({ options, value, onChange, fit = true }: SegmentedProps) {
  return (
    <Segmented
      options={options.map(o => ({ value: o, label: o }))}
      value={value}
      onChange={onChange}
      size="sm"
      fit={fit}
    />
  );
}
