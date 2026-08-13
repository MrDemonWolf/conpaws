/**
 * ConPaws mark — compass rose with a paw at its centre.
 *
 * Traced from the flat brand logo. Uses `currentColor` so it inherits from the
 * surrounding text colour.
 *
 * TODO: replace with the real vector export when source art is available. The
 * repo currently ships only PNGs (apps/native/assets/images/), so this is a
 * hand-trace and not authoritative.
 */
export function CompassPaw({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="currentColor"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      {/* ring, broken at the four cardinal points */}
      <g fill="none" stroke="currentColor" strokeWidth="7">
        <path d="M110 28.7 A72 72 0 0 1 171.3 90" />
        <path d="M171.3 110 A72 72 0 0 1 110 171.3" />
        <path d="M90 171.3 A72 72 0 0 1 28.7 110" />
        <path d="M28.7 90 A72 72 0 0 1 90 28.7" />
      </g>
      {/* cardinal spikes — E/W break past the ring */}
      <path d="M100 8 L107 60 L100 70 L93 60 Z" />
      <path d="M100 192 L107 140 L100 130 L93 140 Z" />
      <path d="M192 100 L140 107 L130 100 L140 93 Z" />
      <path d="M8 100 L60 107 L70 100 L60 93 Z" />
      {/* diagonal spikes */}
      <path d="M146.7 53.3 L131.1 74.5 L125.5 68.9 Z" />
      <path d="M53.3 53.3 L74.5 68.9 L68.9 74.5 Z" />
      <path d="M146.7 146.7 L131.1 125.5 L125.5 131.1 Z" />
      <path d="M53.3 146.7 L68.9 125.5 L74.5 131.1 Z" />
      {/* paw: four toes + notched pad */}
      <ellipse
        cx="78"
        cy="105"
        rx="8.5"
        ry="11.5"
        transform="rotate(-22 78 105)"
      />
      <ellipse cx="91" cy="93" rx="9" ry="12.5" />
      <ellipse cx="109" cy="93" rx="9" ry="12.5" />
      <ellipse
        cx="122"
        cy="105"
        rx="8.5"
        ry="11.5"
        transform="rotate(22 122 105)"
      />
      <path d="M100 106 C114 106 128 122 128 132 C128 141 117 145 104 142 L100 137 L96 142 C83 145 72 141 72 132 C72 122 86 106 100 106 Z" />
    </svg>
  );
}
