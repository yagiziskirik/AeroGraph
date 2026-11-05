'use client';

import React from 'react';

export interface MechanicalToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const MechanicalToggle: React.FC<MechanicalToggleProps> = ({
  checked,
  defaultChecked,
  onChange,
  disabled,
  label,
  size = 'sm',
  interactive = true,
  className = '',
  id,
  ...props
}) => {
  const isSm = size === 'sm';
  const isMd = size === 'md';

  const width = isSm ? 52 : isMd ? 72 : 96;
  const height = isSm ? 24 : isMd ? 32 : 44;
  const travelX = isSm ? 20 : isMd ? 28 : 38;

  const css = `
    .mech-switch-${size} {
      width: ${width}px;
      height: ${height}px;
      display: inline-block;
      position: relative;
      user-select: none;
      flex-shrink: 0;
    }

    .mech-switch-${size} input {
      display: none;
    }

    .mech-switch-${size} .slider {
      cursor: ${interactive ? 'pointer' : 'default'};
      position: relative;
      width: 100%;
      height: 100%;
      background-color: rgb(8, 8, 8);
      transition: all 0.35s cubic-bezier(0.99, 0.1, 0.1, 0.99);
      border-radius: 4px;
      box-shadow:
        inset 0px 0px 1px 0px rgba(0, 0, 0, 1),
        inset ${width * 0.8}px 0px 30px -20px rgba(126, 4, 4, 0.56);
      border: 1.5px solid black;
    }

    .mech-switch-${size} .slider-btn {
      position: absolute;
      content: '';
      aspect-ratio: 6/4;
      border-radius: 2.5px;
      left: 2px;
      top: 2px;
      bottom: 2px;
      background: linear-gradient(to bottom, #333333, #242323);
      border: 1px solid #2b2b2b;
      background-color: #333333;
      box-shadow:
        0px 4px 4px 1px rgba(0, 0, 0, 0.2),
        inset 6px 0px 6px -3px rgba(126, 4, 4, 0.15);
      transition: all 0.35s cubic-bezier(0.99, 0.1, 0.1, 0.99);
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 0 1px;
    }

    .mech-switch-${size} .texture {
      width: ${isSm ? 1 : 1.5}px;
      height: 65%;
      background-color: #202020ea;
      box-shadow:
        -0.5px -1px 1px 0px rgba(192, 192, 192, 0.3),
        0px 1px 2px rgb(0, 0, 0, 0.3);
    }

    .mech-switch-${size} .light {
      width: ${isSm ? 3 : 4}px;
      height: ${isSm ? 3 : 4}px;
      border: 1px solid #222121;
      border-radius: 50%;
      transition: all 0.35s cubic-bezier(0.99, 0.1, 0.1, 0.99);
      background-color: rgb(230, 14, 14);
      box-shadow: 0px 0px 6px 1px rgb(241, 28, 28);
    }

    .mech-switch-${size} input:checked + .slider {
      box-shadow:
        inset 0px 0px 1px 0px rgba(0, 0, 0, 1),
        inset -${width * 0.8}px 0px 30px -20px rgba(1, 78, 4, 0.6);
    }

    .mech-switch-${size} input:checked + .slider .slider-btn {
      transform: translateX(${travelX}px);
      box-shadow:
        0px 4px 4px 1px rgba(0, 0, 0, 0.2),
        inset -6px 0px 6px -3px rgba(1, 112, 4, 0.15);
    }

    .mech-switch-${size} input:checked + .slider .slider-btn .light {
      background-color: rgb(35, 158, 4);
      box-shadow: 0px 0px 6px 0px rgb(57, 230, 14);
    }
  `;

  return (
    <div
      className={`inline-flex items-center space-x-2 select-none ${
        interactive ? '' : 'pointer-events-none'
      } ${className}`.trim()}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <label className={`mech-switch-${size}`}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={interactive ? onChange : undefined}
          disabled={disabled || !interactive}
          readOnly={!interactive}
          {...props}
        />
        <div className="slider">
          <div className="slider-btn">
            <div className="light" />
            <div className="texture" />
            <div className="texture" />
            <div className="texture" />
            <div className="light" />
          </div>
        </div>
      </label>

      {label && (
        <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase select-none">
          {label}
        </span>
      )}
    </div>
  );
};
