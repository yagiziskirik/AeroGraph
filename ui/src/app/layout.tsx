import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AeroGraph Tactical Console',
  description: 'Falcon BMS 4.38 Avionics & Kneeboard System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#0A0A0C]" style={{ backgroundColor: '#0A0A0C', background: '#0A0A0C' }}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                background-color: #0A0A0C !important;
                background: #0A0A0C !important;
                color: #F4F4F5 !important;
                margin: 0;
                padding: 0;
              }
              @keyframes aerographPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('contextmenu', function(e) { e.preventDefault(); });`,
          }}
        />
      </head>
      <body
        style={{ backgroundColor: '#0A0A0C', background: '#0A0A0C' }}
        className="bg-void-0 text-text-primary antialiased select-none overflow-hidden h-screen w-screen border border-border-hairline rounded-lg"
      >
        {/* Instant Tactical HUD Loading Splash (Eliminates white flashbang & provides immediate feedback) */}
        <div
          id="aerograph-splash"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#0A0A0C',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            transition: 'opacity 0.25s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 14px #10B981',
                animation: 'aerographPulse 1.2s ease-in-out infinite',
              }}
            />
            <span
              style={{
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              AEROGRAPH TACTICAL CONSOLE // INITIALIZING...
            </span>
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '10px',
              color: '#71717A',
              letterSpacing: '0.1em',
            }}
          >
            CONNECTING AVIONICS BUS &amp; BMS FLIGHT DATA
          </div>
        </div>

        {children}
      </body>
    </html>
  );
}
