/** Tag types mirrored from `models/tag.rs` (reserved: no page reads them yet). */

export interface Tag {
  id: number;
  name: string;
  /** UTC epoch seconds. */
  createdAt: number;
}
