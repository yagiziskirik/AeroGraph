'use client';

import React from 'react';

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioInputsProps {
  options: (string | RadioOption)[];
  value?: string;
  defaultValue?: string;
  name?: string;
  onChange?: (val: string) => void;
  className?: string;
  itemClassName?: string;
}

export const RadioInputs: React.FC<RadioInputsProps> = ({
  options,
  value,
  defaultValue,
  name = 'radio-group',
  onChange,
  className = '',
  itemClassName = '',
}) => {
  const [internalValue, setInternalValue] = React.useState<string>(() => {
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return defaultValue;
    const first = options[0];
    return typeof first === 'string' ? first : first ? first.value : '';
  });

  const activeValue = value !== undefined ? value : internalValue;

  const handleChange = (val: string) => {
    if (value === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);
  };

  const css = `
    .radio-inputs-root {
      overflow: visible !important;
    }
    .radio-input-item {
      overflow: visible !important;
      position: relative;
    }
    .radio-input-pill {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      padding: 0.375rem 0.75rem;
      color: #a1a1aa;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      font-family: inherit;
      white-space: nowrap;
      overflow: visible !important;
    }
    .radio-input-pill:hover {
      color: #ffffff;
      background-color: rgba(255, 255, 255, 0.05);
    }
    .radio-input-item input:checked + .radio-input-pill {
      background-color: #27272a;
      color: var(--accent-color, #10B981);
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 10px -2px var(--accent-color, rgba(16, 185, 129, 0.35));
      animation: radioSelectAnim 0.3s ease;
    }
    .radio-input-item input:checked + .radio-input-pill::before,
    .radio-input-item input:checked + .radio-input-pill::after {
      content: '';
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--accent-color, #10B981);
      opacity: 0;
      pointer-events: none;
      z-index: 50;
      left: 50%;
      margin-left: -2px;
    }
    .radio-input-item input:checked + .radio-input-pill::before {
      top: -6px;
      animation: radioParticleUp 0.5s ease forwards;
    }
    .radio-input-item input:checked + .radio-input-pill::after {
      bottom: -6px;
      animation: radioParticleDown 0.5s ease forwards;
    }
    @keyframes radioSelectAnim {
      0% { transform: scale(0.96); }
      50% { transform: scale(1.04); }
      100% { transform: scale(1); }
    }
    @keyframes radioParticleUp {
      0% {
        opacity: 0;
        transform: translateY(0);
      }
      50% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(-10px);
      }
    }
    @keyframes radioParticleDown {
      0% {
        opacity: 0;
        transform: translateY(0);
      }
      50% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(10px);
      }
    }
  `;

  return (
    <div
      className={`radio-inputs-root relative inline-flex flex-wrap items-center rounded-lg p-1 box-border select-none bg-[#18181b] border border-white/[0.08] shadow-inner font-mono text-xs overflow-visible ${className}`.trim()}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {options.map((opt, idx) => {
        const optionVal = typeof opt === 'string' ? opt : opt.value;
        const optionLabel = typeof opt === 'string' ? opt : opt.label;
        const isChecked = activeValue === optionVal;

        return (
          <label
            key={`${name}-${optionVal}-${idx}`}
            className={`radio-input-item flex-1 text-center cursor-pointer ${itemClassName}`.trim()}
          >
            <input
              type="radio"
              name={name}
              value={optionVal}
              checked={isChecked}
              onChange={() => handleChange(optionVal)}
              className="sr-only"
            />
            <span className="radio-input-pill">{optionLabel}</span>
          </label>
        );
      })}
    </div>
  );
};
