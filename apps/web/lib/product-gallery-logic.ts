export type LightboxKeyAction = 'close' | 'prev' | 'next' | 'noop';

export function getActiveImageIndex(
  images: ReadonlyArray<{ storageKey: string }>,
  activeKey: string | null,
): number {
  if (images.length === 0) {
    return -1;
  }
  const index = images.findIndex((image) => image.storageKey === activeKey);
  return index >= 0 ? index : 0;
}

export function canGoPrevious(index: number): boolean {
  return index > 0;
}

export function canGoNext(index: number, count: number): boolean {
  return count > 0 && index >= 0 && index < count - 1;
}

/** Ends are disabled (no wrap-around) for clearer accessible state. */
export function stepLightboxIndex(
  index: number,
  count: number,
  direction: 'prev' | 'next',
): number {
  if (count <= 0 || index < 0) {
    return index;
  }
  if (direction === 'prev') {
    return canGoPrevious(index) ? index - 1 : index;
  }
  return canGoNext(index, count) ? index + 1 : index;
}

export function resolveLightboxKeyAction(
  key: string,
  index: number,
  count: number,
): LightboxKeyAction {
  switch (key) {
    case 'Escape':
      return 'close';
    case 'ArrowLeft':
      return canGoPrevious(index) ? 'prev' : 'noop';
    case 'ArrowRight':
      return canGoNext(index, count) ? 'next' : 'noop';
    default:
      return 'noop';
  }
}

export type LightboxState = {
  open: boolean;
  index: number;
};

export type LightboxCommand =
  | { type: 'open'; index: number }
  | { type: 'close' }
  | { type: 'prev' }
  | { type: 'next' }
  | { type: 'key'; key: string };

export function reduceLightboxState(
  state: LightboxState,
  command: LightboxCommand,
  imageCount: number,
): LightboxState {
  switch (command.type) {
    case 'open': {
      if (imageCount <= 0) {
        return state;
      }
      const index = Math.min(Math.max(command.index, 0), imageCount - 1);
      return { open: true, index };
    }
    case 'close':
      return state.open ? { ...state, open: false } : state;
    case 'prev':
      if (!state.open) {
        return state;
      }
      return {
        ...state,
        index: stepLightboxIndex(state.index, imageCount, 'prev'),
      };
    case 'next':
      if (!state.open) {
        return state;
      }
      return {
        ...state,
        index: stepLightboxIndex(state.index, imageCount, 'next'),
      };
    case 'key': {
      if (!state.open) {
        return state;
      }
      const action = resolveLightboxKeyAction(
        command.key,
        state.index,
        imageCount,
      );
      if (action === 'close') {
        return { ...state, open: false };
      }
      if (action === 'prev') {
        return {
          ...state,
          index: stepLightboxIndex(state.index, imageCount, 'prev'),
        };
      }
      if (action === 'next') {
        return {
          ...state,
          index: stepLightboxIndex(state.index, imageCount, 'next'),
        };
      }
      return state;
    }
    default:
      return state;
  }
}
