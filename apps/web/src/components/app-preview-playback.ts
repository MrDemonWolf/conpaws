/** Subscribe only while playback is active; cleanup stops the next frame. */
export function startPreviewRotation(
  motion: MediaQueryList,
  tick: () => void,
  reset: () => void,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const update = () => {
    clearInterval(timer);
    if (motion.matches) reset();
    else timer = setInterval(tick, 12_000);
  };
  update();
  motion.addEventListener("change", update);
  return () => {
    clearInterval(timer);
    motion.removeEventListener("change", update);
  };
}
