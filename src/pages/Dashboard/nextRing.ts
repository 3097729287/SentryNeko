/** Next alarm to ring, resolved from the list the reminder panel shows. */

import { isOneOff } from "../../types/alarm";
import type { Alarm } from "../../types/alarm";

/**
 * Next enabled alarm and when it rings, or `null` when none is switched on.
 *
 * The scan walks the next week, so a repeating alarm that already passed today lands on its next
 * selected weekday; a one-off rings at its next occurrence, which is today or tomorrow.
 */
export function nextRing(alarms: readonly Alarm[], now: Date): { alarm: Alarm; at: Date } | null {
  let best: { alarm: Alarm; at: Date } | null = null;

  for (const alarm of alarms) {
    if (!alarm.enabled) {
      continue;
    }

    for (let offset = 0; offset < 8; offset += 1) {
      const at = new Date(now);
      at.setDate(at.getDate() + offset);
      at.setHours(alarm.hour, alarm.minute, 0, 0);

      // Monday is bit 0 of the mask, so Sunday (0) wraps to 6.
      const day = (at.getDay() + 6) % 7;

      if (at <= now || (!isOneOff(alarm) && (alarm.repeatDays & (1 << day)) === 0)) {
        continue;
      }

      if (best === null || at < best.at) {
        best = { alarm, at };
      }

      break;
    }
  }

  return best;
}
