/** Tag data access hook: the catalog every tag-aware page reads. */

import { useTagStore } from "../stores/tagStore";
import type { TagState } from "../stores/tagStore";

/** Tag state and actions for a component; the page decides when to load. */
export function useTags(): TagState {
  return useTagStore();
}
