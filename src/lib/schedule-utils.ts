/**
 * Shared scheduling utilities for the autonomous AI marketing agent.
 * 
 * Core logic for:
 * - Parsing Arabic 12h time format (ص/م) and 24h format
 * - Finding the nearest future preferred time
 * - Distributing multiple posts across different preferred times
 * 
 * Example flow:
 *   Current time: 2:00 AM
 *   Preferred times: [3ص, 4ص, 5ص, 6ص, 9ص, 12م, 6م, 9م]
 *   Post 1 → scheduled to 3:00 AM (nearest future)
 *   Post 2 → scheduled to 4:00 AM (next slot)
 *   Post 3 → scheduled to 5:00 AM (next slot)
 *   ...and so on
 */

// ============================================================
// Time Parsing
// ============================================================

/**
 * Parse an Arabic 12h time string (e.g., "9ص", "10م", "12ص") or 24h format ("09:00")
 * Returns hour (0-23) and minute, or null if unparseable.
 */
export function parseArabicTime(timeStr: string): { hour: number; minute: number } | null {
  // Try Arabic format first (e.g., "9ص", "10م", "12ص", "1م")
  const arabicMatch = timeStr.match(/^(\d{1,2})(ص|م)$/);
  if (arabicMatch) {
    let hour = parseInt(arabicMatch[1]);
    const period = arabicMatch[2];
    
    if (period === 'ص') { // AM
      if (hour === 12) hour = 0; // 12ص = midnight
    } else { // PM
      if (hour !== 12) hour += 12; // 1م=13, 12م=12
    }
    
    return { hour, minute: 0 };
  }

  // Try 24-hour format (e.g., "09:00", "18:00")
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    return { hour: parseInt(timeMatch[1]), minute: parseInt(timeMatch[2]) };
  }

  return null;
}

/**
 * Convert hour:minute to total minutes from midnight
 */
export function toTotalMinutes(hour: number, minute: number = 0): number {
  return hour * 60 + minute;
}

/**
 * Convert total minutes from midnight to a Date object for a given base date.
 * If the time is earlier than the base date's time, it moves to the next day.
 */
export function minutesToDate(totalMinutes: number, baseDate: Date): Date {
  const date = new Date(baseDate);
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return date;
}

// ============================================================
// Preferred Times Parsing
// ============================================================

export interface PreferredTimeSlot {
  totalMinutes: number; // minutes from midnight (0-1439)
  label: string;        // original label (e.g., "3ص")
  hour24: number;       // 24h format hour (0-23)
  minute: number;       // minutes (0-59)
}

/**
 * Parse the preferredTimes string from ScheduleConfig or AgentSettings.
 * Handles:
 * - JSON array: '["3ص", "4ص"]'
 * - Comma-separated: "3ص, 4ص, 6م"
 * - Arabic 12h: "3ص", "12م"
 * - 24h format: "09:00", "18:00"
 */
export function parsePreferredTimes(preferredTimesRaw: string): PreferredTimeSlot[] {
  let raw = preferredTimesRaw || '';
  
  // Try parsing as JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      raw = parsed.join(', ');
    } else if (typeof parsed === 'string') {
      raw = parsed;
    }
  } catch {
    // Not JSON, use as-is
  }
  
  const timeStrings = raw.split(',').map(t => t.trim()).filter(Boolean);
  
  const slots: PreferredTimeSlot[] = [];
  for (const timeStr of timeStrings) {
    const parsed = parseArabicTime(timeStr);
    if (parsed) {
      slots.push({
        totalMinutes: toTotalMinutes(parsed.hour, parsed.minute),
        label: timeStr,
        hour24: parsed.hour,
        minute: parsed.minute,
      });
    }
  }
  
  // Sort by minutes from midnight (earliest first)
  slots.sort((a, b) => a.totalMinutes - b.totalMinutes);
  
  return slots;
}

// ============================================================
// Next Preferred Time Calculation
// ============================================================

/**
 * Get the next N preferred time slots starting from the current time.
 * 
 * This is the core scheduling function:
 * - If it's 2:00 AM and preferred times are [3ص, 4ص, 5ص, 6ص, 9ص, 12م, 6م, 9م]
 * - And we need 3 slots:
 *   - Slot 1: today at 3:00 AM
 *   - Slot 2: today at 4:00 AM  
 *   - Slot 3: today at 5:00 AM
 * 
 * - If it's 10:00 PM and preferred times are [3ص, 6ص]
 * - And we need 3 slots:
 *   - Slot 1: tomorrow at 3:00 AM
 *   - Slot 2: tomorrow at 6:00 AM
 *   - Slot 3: day after tomorrow at 3:00 AM
 *
 * @param preferredTimeSlots - Parsed preferred time slots (sorted)
 * @param now - Current time reference
 * @param count - Number of time slots needed
 * @returns Array of Dates for scheduling, one per post
 */
export function getNextPreferredTimes(
  preferredTimeSlots: PreferredTimeSlot[],
  now: Date,
  count: number
): Date[] {
  if (preferredTimeSlots.length === 0 || count <= 0) return [];

  const results: Date[] = [];
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Build a circular list of all preferred times
  // First, find the index of the first future time today
  // Use >= so that if we're exactly at the preferred time, we schedule to the NEXT one
  // (the current time slot is for publishing, not scheduling new posts)
  let startIdx = -1;
  for (let i = 0; i < preferredTimeSlots.length; i++) {
    if (preferredTimeSlots[i].totalMinutes > currentTotalMinutes) {
      startIdx = i;
      break;
    }
  }
  
  // If no future time today, start from the first time tomorrow
  if (startIdx === -1) {
    startIdx = 0;
  }
  
  // Generate scheduled times by cycling through preferred slots
  let dayOffset = startIdx === 0 && preferredTimeSlots[0].totalMinutes <= currentTotalMinutes ? 1 : 0;
  let idx = startIdx;
  
  for (let i = 0; i < count; i++) {
    const slot = preferredTimeSlots[idx];
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
    scheduledDate.setHours(slot.hour24, slot.minute, 0, 0);
    
    results.push(scheduledDate);
    
    // Move to the next slot
    idx++;
    if (idx >= preferredTimeSlots.length) {
      idx = 0;
      dayOffset++;
    }
  }
  
  return results;
}

/**
 * Get the single nearest future preferred time.
 * Convenience wrapper around getNextPreferredTimes for 1 post.
 */
export function getNearestPreferredTime(
  preferredTimeSlots: PreferredTimeSlot[],
  now: Date
): Date | null {
  const times = getNextPreferredTimes(preferredTimeSlots, now, 1);
  return times.length > 0 ? times[0] : null;
}
