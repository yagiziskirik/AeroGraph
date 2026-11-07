'use client';

import React, { useId } from 'react';

export interface LeverSwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  fontSize?: number;
  showPlate?: boolean;
  showLeds?: boolean;
  interactive?: boolean;
}

export const LeverSwitch: React.FC<LeverSwitchProps> = ({
  checked,
  defaultChecked,
  onChange,
  disabled,
  label,
  fontSize = 8,
  showPlate = false,
  showLeds = true,
  interactive = true,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const css = `
    .lever-switch-root {
      display: flex;
      justify-content: center;
      align-items: center;
      --dur: 0.1s;
      font-size: ${fontSize}px;
      border-radius: 8px;
    }

    .lever-switch-root .switch-box {
      position: relative;
      width: 12em;
      height: 12em;
      font-size: 1em;
    }

    .lever-switch-root .lever-input {
      background-image:
        radial-gradient(1em 1.5em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
        radial-gradient(0.65em 1em at 50% 53%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
        radial-gradient(0.75em 0.75em at 55% 45%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
        radial-gradient(0.5em 0.4em at 43% 56%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0)),
        radial-gradient(0.5em 0.4em at 55% 57%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)),
        radial-gradient(0.5em 0.4em at 50% 60%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)),
        radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgba(221, 221, 221, 0) 30%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68, 0) 35.5%, rgba(221, 221, 221, 0) 41%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85, 0) 50%),
        radial-gradient(2em 2em at 35% 20%, rgb(255, 255, 255), rgba(255, 255, 255, 0) 2em),
        radial-gradient(2em 2em at 65% 80%, rgb(255, 255, 255), rgba(255, 255, 255, 0) 2em),
        radial-gradient(2em 2em at 80% 35%, rgb(255, 255, 255), rgba(255, 255, 255, 0) 2em),
        radial-gradient(2em 2em at 20% 65%, rgb(255, 255, 255), rgba(255, 255, 255, 0) 2em),
        radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%);
      background-position:
        0.5em 0, 0.5em 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0;
      border-radius: 50%;
      box-shadow: 0 1.5em 1.5em rgba(0, 0, 0, 0.4);
      cursor: ${interactive ? 'pointer' : 'default'};
      display: block;
      outline: 0;
      width: 100%;
      height: 100%;
      -webkit-appearance: none;
      appearance: none;
      transition: background-position var(--dur) linear;
    }

    .lever-switch-root .lever-input:checked {
      background-position:
        -0.5em 0, -0.5em 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0;
    }

    .lever-switch-root .lever-parts {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .lever-switch-root .lever-ball {
      background:
        radial-gradient(35% 25% at 50% 25%, rgb(136, 136, 153) 20%, rgba(136, 136, 153, 0)),
        radial-gradient(1em 0.75em at 32% 75%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
        radial-gradient(1em 0.75em at 65% 78%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
        radial-gradient(100% 100% at center, rgb(68, 68, 68) 49.5%, rgba(68, 68, 68, 0) 50%);
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 4em;
      height: 4em;
      transform: translate(100%, -50%);
      box-shadow:
        -2em 4em 2em rgba(0, 0, 0, 0.3),
        -2em 5em 4em rgba(0, 0, 0, 0.2),
        -2em 7em 4em rgba(0, 0, 0, 0.2),
        -2em 9em 4em rgba(0, 0, 0, 0.2);
      z-index: 1;
      transition:
        transform var(--dur) linear,
        box-shadow var(--dur) linear;
    }

    .lever-switch-root .lever-shaft {
      background-color: #2b2b2b;
      border-radius: 15em;
      box-shadow: 0 0 0.8em #555 inset;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 7.5em;
      height: 4em;
      transform: translate(0.5em, -50%);
      transition: transform var(--dur) linear;
    }

    .lever-switch-root .lever-input:checked ~ .lever-parts .lever-ball {
      transform: translate(-200%, -50%);
      box-shadow:
        2em 4em 2em rgba(0, 0, 0, 0.3),
        2em 5em 4em rgba(0, 0, 0, 0.2),
        2em 7em 4em rgba(0, 0, 0, 0.2),
        2em 9em 4em rgba(0, 0, 0, 0.2);
    }

    .lever-switch-root .lever-input:checked ~ .lever-parts .lever-shaft {
      transform: translate(-8em, -50%);
    }

    .lever-switch-root .led-indicator {
      background-image:
        radial-gradient(0.3em 0.25em at 50% 25%, rgb(255, 255, 255) 25%, rgba(255, 255, 255, 0)),
        radial-gradient(0.25em 0.25em at 30% 75%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0)),
        radial-gradient(0.3em 0.3em at 60% 80%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0)),
        radial-gradient(100% 100%, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 0.3) 40%, rgba(0, 0, 0, 0.5) 50%);
      border-radius: 50%;
      width: 1.5em;
      height: 1.5em;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      display: block;
      transition: all 0.15s 0.15s linear;
    }

    .lever-switch-root .led-left {
      left: -2.8em;
      background-color: #050;
      box-shadow: 0 0.5em 0.75em rgba(0, 0, 0, 0.3);
    }

    .lever-switch-root .led-right {
      right: -2.8em;
      background-color: #f00;
      box-shadow: 0 0 0.75em #f00, 0 0.5em 0.75em rgba(0, 0, 0, 0.3);
    }

    .lever-switch-root .lever-input:checked ~ .led-left {
      background-color: #0d0;
      box-shadow: 0 0 0.75em #0f0, 0 0.5em 0.75em rgba(0, 0, 0, 0.3);
    }

    .lever-switch-root .lever-input:checked ~ .led-right {
      background-color: #500;
      box-shadow: 0 0 0.75em rgba(0, 0, 0, 0.3);
    }

    .lever-switch-root .led-indicator span {
      display: inline-block;
      overflow: hidden;
      width: 0;
    }
  `;

  return (
    <div
      className={`inline-flex flex-col items-center select-none ${
        interactive ? '' : 'pointer-events-none'
      } ${className}`.trim()}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        className={`lever-switch-root ${
          showPlate ? 'bg-[#dbdfdb] p-4 shadow-inner border border-black/20' : 'p-1 bg-transparent'
        }`}
      >
        <div className="switch-box">
          <input
            type="checkbox"
            className="lever-input"
            id={inputId}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={interactive ? onChange : undefined}
            disabled={disabled || !interactive}
            readOnly={!interactive}
            {...props}
          />
          {showLeds && (
            <>
              <label htmlFor={inputId} className="led-indicator led-left">
                <span>On</span>
              </label>
              <label htmlFor={inputId} className="led-indicator led-right">
                <span>Off</span>
              </label>
            </>
          )}
          <div className="lever-parts">
            <div className="lever-shaft" />
            <div className="lever-ball" />
          </div>
        </div>
      </div>

      {label && (
        <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase mt-1 select-none">
          {label}
        </span>
      )}
    </div>
  );
};
