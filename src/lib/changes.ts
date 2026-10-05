// Tiny pub/sub so the backup can react to local writes without db.ts depending on it

type Listener = () => void;

const listeners = new Set<Listener>();

export function onDataChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDataChanged() {
  for (const listener of listeners) listener();
}
