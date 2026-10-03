export function createFavoriteOrderAutosave() {
  let pending: { save: () => Promise<void>; onError: (error: unknown) => void } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  async function drain() {
    if (running || timer !== null || !pending) return;
    const operation = pending;
    pending = null;
    running = true;
    try {
      await operation.save();
    } catch (error) {
      operation.onError(error);
    } finally {
      running = false;
      void drain();
    }
  }

  return {
    schedule(save: () => Promise<void>, onError: (error: unknown) => void) {
      pending = { save, onError };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void drain();
      }, 1000);
    },
    flush() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      void drain();
    },
  };
}
