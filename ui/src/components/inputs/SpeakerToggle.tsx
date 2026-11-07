'use client';

import React from 'react';

export interface SpeakerToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  size?: number;
  interactive?: boolean;
  activeColor?: string;
}

export const SpeakerToggle: React.FC<SpeakerToggleProps> = ({
  checked,
  defaultChecked,
  onChange,
  disabled,
  label,
  size = 20,
  interactive = true,
  activeColor = '#10B981',
  className = '',
  id,
  ...props
}) => {
  const css = `
    @keyframes speakerPop {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
  `;

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 align-middle ${
        interactive ? '' : 'pointer-events-none'
      } ${className}`.trim()}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <label
        className={`relative inline-flex items-center justify-center select-none text-[#a5a5b0] ${
          interactive ? 'cursor-pointer hover:text-white' : 'cursor-default'
        } transition-colors`}
        style={{ width: size, height: size }}
      >
        <input
          type="checkbox"
          id={id}
          className="sr-only peer"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={interactive ? onChange : undefined}
          disabled={disabled || !interactive}
          readOnly={!interactive}
          {...props}
        />
        <svg
          viewBox="0 0 576 512"
          className="w-full h-full fill-current peer-checked:hidden animate-[speakerPop_0.4s_ease-out]"
        >
          <path d="M301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM425 167l55 55 55-55c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-55 55 55 55c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-55-55-55 55c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l55-55-55-55c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0z" />
        </svg>
        <svg
          viewBox="0 0 448 512"
          className="w-full h-full hidden peer-checked:block animate-[speakerPop_0.4s_ease-out]"
          style={{ fill: activeColor }}
        >
          <path d="M301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3zM412.6 181.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5z" />
        </svg>
      </label>
      {label && (
        <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase select-none ml-2">
          {label}
        </span>
      )}
    </div>
  );
};
