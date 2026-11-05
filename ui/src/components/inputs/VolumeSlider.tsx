'use client';

import React from 'react';

export interface VolumeSliderProps {
  value: number; // typically 0 to 1
  onChangeValue: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showPercentage?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  value,
  onChangeValue,
  min = 0,
  max = 1,
  step = 0.01,
  showPercentage = true,
  className = '',
  disabled = false,
  id = 'volume-slider',
}) => {
  const css = `
    .volume-slider-label {
      --slider-width: 140px;
      --slider-height: 12px;
      --slider-bg: rgba(255, 255, 255, 0.08);
      --slider-border-radius: 4px;
      --level-color: var(--accent-color, #10B981);
      --icon-color: var(--accent-color, #10B981);
      
      position: relative;
      cursor: pointer;
      display: inline-flex;
      flex-direction: row-reverse;
      align-items: center;
      gap: 10px;
      user-select: none;
    }

    .volume-slider-label .volume-icon {
      width: 18px;
      height: 18px;
      color: var(--icon-color);
      opacity: 0.8;
      transition: all 0.25s ease;
      flex-shrink: 0;
      pointer-events: none;
    }

    .volume-slider-label:hover .volume-icon,
    .volume-slider-label .level-input:hover ~ .volume-icon {
      opacity: 1;
      filter: drop-shadow(0 0 6px var(--level-color));
    }

    .volume-slider-label .level-input {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      width: var(--slider-width);
      height: var(--slider-height);
      background: var(--slider-bg);
      overflow: hidden;
      border-radius: var(--slider-border-radius);
      cursor: inherit;
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: border-color 0.2s ease;
    }

    .volume-slider-label .level-input:hover {
      border-color: rgba(255, 255, 255, 0.25);
    }

    .volume-slider-label .level-input::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 0px;
      height: 0px;
      box-shadow:
        -120px 0 5px 120px var(--level-color),
        -120px 0px 20px 120px var(--level-color);
      cursor: inherit;
    }

    .volume-slider-label .level-input::-moz-range-thumb {
      width: 0;
      height: 0;
      border-radius: 0;
      border: none;
      box-shadow:
        -120px 0 5px 120px var(--level-color),
        -120px 0px 20px 120px var(--level-color);
      cursor: inherit;
    }

    .volume-slider-label .level-input::-moz-range-progress {
      background-color: var(--level-color);
      height: 100%;
    }
  `;

  const percent = Math.round(((value - min) / (max - min)) * 100);

  return (
    <div className={`inline-flex items-center space-x-3 select-none font-mono ${className}`.trim()}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <label className="volume-slider-label" htmlFor={id}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChangeValue(parseFloat(e.target.value))}
          className="level-input"
        />
        <svg
          className="volume-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            <path d="M18.36 19.36a1 1 0 0 1-.705-1.71C19.167 16.148 20 14.142 20 12s-.833-4.148-2.345-5.65a1 1 0 1 1 1.41-1.419C20.958 6.812 22 9.322 22 12s-1.042 5.188-2.935 7.069a.997.997 0 0 1-.705.291z" />
            <path d="M15.53 16.53a.999.999 0 0 1-.703-1.711C15.572 14.082 16 13.054 16 12s-.428-2.082-1.173-2.819a1 1 0 1 1 1.406-1.422A6 6 0 0 1 18 12a6 6 0 0 1-1.767 4.241.996.996 0 0 1-.703.289zM12 22a1 1 0 0 1-.707-.293L6.586 17H4c-1.103 0-2-.897-2-2V9c0-1.103.897-2 2-2h2.586l4.707-4.707A.998.998 0 0 1 13 3v18a1 1 0 0 1-1 1z" />
          </g>
        </svg>
      </label>
      {showPercentage && (
        <span className="font-mono text-xs font-bold text-white w-10 text-right">
          {percent}%
        </span>
      )}
    </div>
  );
};
