/**
 * ConPaws mark — compass rose with a paw at its centre.
 *
 * This is the real logo. It is traced from the brand art at
 * `apps/native/assets/images/ConPaws.icon/Assets/logo.png` (2400px, the same
 * file the app icons are built from), so the web mark and the app icon are now
 * the same shape rather than two drawings that merely resemble each other.
 *
 * What it replaces was a hand-trace with a `TODO: replace with the real vector
 * export`. It was close enough to pass at nav size and wrong everywhere it
 * mattered: the paw pad was a notched blob instead of the rounded triangle, the
 * north and south spikes were stubs rather than needles, and the east and west
 * arrows were the wrong width entirely.
 *
 * To regenerate after a logo change:
 *
 *   magick logo.png -alpha extract -threshold 50% -negate mask.pbm
 *   potrace mask.pbm --svg --alphamax 1.0 --opttolerance 0.15 --turdsize 8 -o raw.svg
 *   # scale the 2400 box to 200, then svgo at floatPrecision 1
 *
 * `apps/web/src/app/icon.svg` carries the same three paths and has to be
 * regenerated in step — it is a standalone document (it answers
 * prefers-color-scheme, which this component cannot), so the duplication is
 * structural rather than an oversight.
 *
 * The viewBox is cropped to the artwork rather than the `0 0 200 200` the trace
 * produced. The logo only inks x 37-163 of that box, so leaving it untrimmed
 * padded every instance with roughly 18% dead space per side and drew the mark
 * visibly smaller than the hand-trace did at identical classes.
 *
 * Uses `currentColor` so it inherits from the surrounding text colour.
 */
export function CompassPaw({ className }: { className?: string }) {
  return (
    <svg
      viewBox="35 34 130 130"
      fill="currentColor"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <path d="m99.7 36.7-.8 4.5-.4 2.2L96 56l-.6 3.1-2 11.8.7.3q2.5.9 4 2.5l1 .9c.3.2 1.4.2 1.7 0l1-.8q.9-1.2 1.5-1.5l2.5-1.1.7-.2v-.4l-.1-.9-.5-2.4-.5-2.8-1.3-6.3-.3-2-.3-1.4-.4-2.3-3.3-17zm-7.2 12A73 73 0 0 0 82 51.5 52 52 0 0 0 50.5 88q-1 4-.7 5h.3c.4 0 3.2-.4 3.8-.6q.9-.1 1-1.3a48 48 0 0 1 8-19.2l.8-1.1.8-1 1.3-1.6a47 47 0 0 1 26.7-14.7c.4-.2.6-.5.8-1.7l.4-3q-.2-.3-1.2-.1m13.7 0 .4 3q.3 1.5.7 1.7l1.3.4a40 40 0 0 1 11 3.5 55 55 0 0 1 13.8 10.1 42 42 0 0 1 7.8 11.5 46 46 0 0 1 3.8 12.6c.2.7.6.9 2.7 1.2 1.9.4 2.3.4 2.3.3v-1.8l-.3-1.6-1.5-6a51 51 0 0 0-41-35q-1.2 0-1 .2" />
      <path d="m69.7 69.2 2 2.9 1.5 2 .8 1.2c0 .2.8 1 1.5 2l2.8 4c.3.6 1 1.2 1.2 1.3q.3.2 1.1.1c1.3 0 1.4-.2 1.6-1.7l.4-1.6.2-1.1c0-.4 0-.4-6-4.4zm59.8.3-1.6 1.2a123 123 0 0 1-10.3 7l-.5.5.2 1 .4 2 .3 1.3c.3.3 1.7.5 2.3.3.4-.2.8-.6 1.9-2.1l3.6-5.2 2.3-3.2 1.9-2.7q.3-.6-.5 0m-22 5.5q-2.2.5-3.9 3-.9 1.3-1.3 3-1.4 3.8 0 7.4a6 6 0 0 0 5 3.8q2.3 0 4-1.8a11 11 0 0 0 2.4-9.7q-.5-3-2.3-4.6-1.4-1.6-3.9-1m-17 0q-.7.1-1.6.7c-1.8 1.3-3 4-3 7.1 0 2.2.5 3.8 1.4 5.6q.4 1 1.2 1.7 1.3 1.4 2.8 1.8c.5.2 2 .2 2.5 0q2.5-.7 3.6-2.9 1.5-2.8.6-6.9-.3-1.7-1-3-1.5-3-3.8-4c-.4-.1-.6-.2-1.5-.2zM79 87.6q-1.7.7-2.4 3t-.3 4.7q.8 4 2.7 5.7 1.9 1.5 3.8 1.3t3-2.3q1-2 .5-4.9a12 12 0 0 0-2-5c-.3-.5-1.3-1.5-1.9-2q-1-.6-2-.6zm39.6 0a5 5 0 0 0-2 1.3c-1 1-1.5 1.6-2.3 3.3a10 10 0 0 0-.7 6.4q.4 1.7 1.2 2.7c1.3 1.4 3.7 1.5 5.4.2q2.5-2 3.3-6.4.3-1.7 0-3.3-.6-3.1-2.5-4-.6-.4-1.3-.3zm9 5.2-.3 2q0 2.5-.5 3.5l-.7 1.6a10 10 0 0 0-1.4 4.4l-.4 2.8 2.8-.5 3-.6 11.4-2.2 2.6-.5 2.3-.5 7.9-1.5 7.4-1.4.8-.2v-.1c0-.2-.2-.2-2-.5l-9-1.7-4-.8-9.9-1.8zm-58 .4a551 551 0 0 1-24.2 4.7l-4 .8c-3.5.6-4 .8-4 .9l4.5 1 4 .8a239 239 0 0 0 13.6 2.6l2.4.5 13.5 2.5-.1-1-.4-2a8 8 0 0 0-.9-3.3l-1-3.1c-.2-.6-.3-1-.3-2.5 0-1.9-.1-2.2-.4-2.4zm28.5 2a18 18 0 0 0-8.7 6.2c-4 4.9-5.6 7.1-6.3 9.3a10 10 0 0 0 .5 7.5 6 6 0 0 0 3.7 2.8c1.3.3 2.2.2 5.5-.6a24 24 0 0 1 14 0c2.5.6 3.1.7 4.2.7.9 0 1 0 1.7-.2q1.2-.4 2.3-1.5l1-1.3q1.1-2.2.9-5-.2-2.6-1.7-5a68 68 0 0 0-4.5-5.9 19 19 0 0 0-8-6.6 7 7 0 0 0-4.6-.4M50 105.8a9 9 0 0 0 .4 3.1l.2 1.3a56 56 0 0 0 5 13.3 50 50 0 0 0 20 20.2c1.7 1 1.6.9 3.5 1.8a46 46 0 0 0 14.3 4c.5 0 .6 0 .4-1.3-.5-2.6-.7-3.3-1-3.6l-2-.5A43 43 0 0 1 64 127.7a44 44 0 0 1-9-19.3c-.2-1.2-.3-1.5-.6-1.7l-1.3-.3zm99.2 0-1.8.4c-1.6.3-2 .5-2.2.7l-.3 1.3A47 47 0 0 1 132 132a47 47 0 0 1-24.8 12.6c-.3.3-.4.7-1 3.7-.2 1.1-.1 1.2.5 1.2a47 47 0 0 0 16.5-5.2 45 45 0 0 0 11-7.6 53 53 0 0 0 15.4-27.6l.5-3q0-.4-.3-.3z" />
      <path d="m120.8 116-.3 1-.4 1.6c-.3.8-1 2-1.4 2.6-.3.5-.4.4.6 1l5.2 3.5a18 18 0 0 1 3.2 2.2c.9.7 1.1.9 1.7 1.2q.8.4.8.1l-2-3-5.1-7.1-1.2-1.8-1-1.4zM78 117.1l-3.9 5.6-4.3 6.5c.2 0 .8-.3 3.1-2l4.2-2.8 4.2-3-1.2-2c-.5-1-.6-1.4-.8-2.4q-.3-1.1-.4-1zm20.6 6.3a24 24 0 0 0-5.5.9q-.2.1-.2.4l.6 3.2 2.6 14.2.8 4.7.4 2.1.5 3 .8 3.9.3 2 .8 5 .1.4.2-.3.4-2.2.5-3.4.5-2.9 1.2-6.7.2-1.6 1.1-5.7 2.9-16-2-.6q-2.8-.6-6.2-.4" />
    </svg>
  );
}
