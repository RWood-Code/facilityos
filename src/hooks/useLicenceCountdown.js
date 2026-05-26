import { useEffect, useState } from 'react';
import { getExpiryCountdown } from '../utils/licenceExpiry';

export function useLicenceCountdown(expiresAt) {
  const [countdown, setCountdown] = useState(() => getExpiryCountdown(expiresAt));

  useEffect(() => {
    const tick = () => setCountdown(getExpiryCountdown(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return countdown;
}
