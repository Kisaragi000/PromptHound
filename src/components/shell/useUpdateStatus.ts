import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../types/global.js';

/** Live auto-update state from the main process; null outside the desktop app */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const updates = window.promptHound?.updates;
    if (!updates) return;
    updates.getStatus().then(setStatus).catch(() => undefined);
    return updates.onStatus(setStatus);
  }, []);

  return status;
}
