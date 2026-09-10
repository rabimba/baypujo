/* Durga Pujo motifs — hand-drawn SVG, single-color via currentColor */

export function DurgaEye({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 110"
      className={className}
      aria-hidden
      role="presentation"
    >
      <g fill="none" strokeLinecap="round">
        <path
          d="M26 38 C 76 6, 164 6, 214 38"
          stroke="currentColor"
          strokeWidth="4"
          opacity="0.55"
        />
        <path
          d="M16 62 C 64 20, 176 20, 224 62 C 176 96, 64 96, 16 62 Z"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          d="M30 61 C 74 30, 166 30, 210 61"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.6"
        />
        <circle cx="120" cy="58" r="21" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="120" cy="58" r="9" fill="currentColor" />
        <circle cx="127" cy="51" r="3.5" fill="#fdf6ec" stroke="none" />
        <path
          d="M28 45 L 18 38 M212 45 L 222 38"
          stroke="currentColor"
          strokeWidth="3"
        />
      </g>
    </svg>
  );
}

export function KaashPhool({
  className,
  flip,
}: {
  className?: string;
  flip?: boolean;
}) {
  const stalks: [string, string][] = [
    ["26 54", "M62 200 C 54 150, 40 96, 26 58"],
    ["46 30", "M62 200 C 58 140, 50 84, 46 34"],
    ["74 26", "M62 200 C 66 144, 70 84, 74 30"],
    ["96 48", "M62 200 C 72 152, 84 100, 96 52"],
  ];
  return (
    <svg
      viewBox="0 0 120 200"
      className={className}
      aria-hidden
      role="presentation"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g stroke="currentColor" fill="none" strokeLinecap="round">
        {stalks.map(([tip, d]) => (
          <g key={tip}>
            <path d={d} strokeWidth="2" opacity="0.8" />
            <g transform={`translate(${tip})`} strokeWidth="2.2">
              <path d="M0 0 C -7 -8, -12 -18, -16 -28" />
              <path d="M0 0 C -2 -10, -4 -20, -6 -32" />
              <path d="M0 0 C 0 -11, 1 -22, 1 -34" />
              <path d="M0 0 C 3 -10, 6 -20, 8 -31" />
              <path d="M0 0 C 8 -8, 13 -17, 18 -26" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

export function AlponaDivider({
  className,
  units = 40,
}: {
  className?: string;
  units?: number;
}) {
  return (
    <div
      className={`overflow-hidden ${className ?? ""}`}
      aria-hidden
      role="presentation"
    >
      <div className="flex justify-center">
        {Array.from({ length: units }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 40 24"
            className="w-10 h-6 shrink-0"
            aria-hidden
          >
            <g fill="none" stroke="currentColor" strokeLinecap="round">
              <path
                d="M4 14 C 10 2, 24 2, 26 10 C 28 18, 16 22, 8 18"
                strokeWidth="1.8"
              />
              <circle cx="33" cy="12" r="2" fill="currentColor" stroke="none" />
            </g>
          </svg>
        ))}
      </div>
    </div>
  );
}

export function Toran({
  className,
  units = 30,
}: {
  className?: string;
  units?: number;
}) {
  return (
    <div
      className={`overflow-hidden ${className ?? ""}`}
      aria-hidden
      role="presentation"
    >
      <div className="flex justify-center">
        {Array.from({ length: units }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 36 38"
            className="w-9 h-[38px] shrink-0"
            aria-hidden
          >
            <path
              d="M0 6 H36"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.7"
            />
            {i % 2 === 0 ? (
              <path
                d="M18 6 C 11 14, 11 26, 18 34 C 25 26, 25 14, 18 6 Z"
                fill="currentColor"
                className="toran-leaf"
              />
            ) : (
              <g className="toran-leaf">
                <path d="M18 6 V10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="18" cy="14" r="4" fill="currentColor" />
              </g>
            )}
          </svg>
        ))}
      </div>
    </div>
  );
}

export function Shiuli({ className }: { className?: string }) {
  const petals = Array.from({ length: 8 }).map((_, i) => {
    const a = (i * Math.PI) / 4;
    return {
      cx: 10 + 6.5 * Math.cos(a),
      cy: 10 + 6.5 * Math.sin(a),
    };
  });
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      role="presentation"
    >
      <g fill="currentColor" opacity="0.85">
        {petals.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="2.1" />
        ))}
      </g>
      <circle cx="10" cy="10" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function Dhunuchi({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 90"
      className={className}
      aria-hidden
      role="presentation"
    >
      <g stroke="currentColor" fill="none" strokeLinecap="round">
        {/* smoke */}
        <path
          d="M30 26 C 25 18, 34 14, 30 6 C 27 12, 33 16, 30 22"
          strokeWidth="2"
          opacity="0.6"
        />
        {/* bowl */}
        <path
          d="M14 40 C 10 54, 16 60, 30 60 C 44 60, 50 54, 46 40 C 38 36, 22 36, 14 40 Z"
          strokeWidth="2.5"
        />
        {/* stem */}
        <path d="M27 60 C 25 68, 26 74, 30 78" strokeWidth="2.5" />
        {/* base */}
        <path d="M20 82 C 24 78, 36 78, 40 82" strokeWidth="2.5" />
        <path d="M18 84 H42" strokeWidth="3" />
      </g>
    </svg>
  );
}
