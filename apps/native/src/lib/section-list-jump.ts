interface Location {
  sectionIndex: number;
  itemIndex: number;
  animated?: boolean;
  viewPosition?: number;
}

/** Advance measurement before retrying a distant row, retaining its section offset. */
export function createSectionListJump(actions: {
  toLocation: (location: Location) => void;
  toOffset: (offset: number) => void;
}) {
  let target: Location | null = null;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    target = null;
  }

  return {
    cancel,
    jump(location: Location) {
      cancel();
      target = location;
      attempts = 0;
      actions.toLocation(location);
    },
    onFailure(info: { index: number; averageItemLength: number }) {
      if (!target || timer !== undefined || attempts >= 3) return;
      attempts++;
      actions.toOffset(Math.max(0, info.index * info.averageItemLength));
      timer = setTimeout(() => {
        timer = undefined;
        if (target) actions.toLocation(target);
      }, 250);
    },
  };
}
