import {
  Activity,
  Apple,
  Baby,
  Bone,
  Brain,
  Building,
  Building2,
  Eye,
  FlaskConical,
  Folder,
  Heart,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Pill,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';

/**
 * Categories store their icon as a lucide component name (the seeded rows use
 * "HeartPulse", "Baby", "Scissors" and so on). Mapping the handful actually in
 * use keeps the icons out of the bundle's critical path — importing all of
 * lucide-react to look one up by string would pull in the entire set.
 */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  Apple,
  Baby,
  Bone,
  Brain,
  Building,
  Building2,
  Eye,
  FlaskConical,
  Heart,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Pill,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
};

export function resolveCategoryIcon(icon?: string | null): LucideIcon | null {
  if (!icon) return null;
  return ICONS[icon.trim()] ?? null;
}

export const FallbackCategoryIcon = Folder;

/** True when the stored icon is an emoji rather than a lucide name. */
export function isEmojiIcon(icon?: string | null): boolean {
  if (!icon) return false;
  const trimmed = icon.trim();
  return trimmed.length > 0 && !/^[A-Za-z0-9]+$/.test(trimmed);
}
