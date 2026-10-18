/** Tag state store: every tag in the database, for the pages that show them. */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";

import { isOk } from "../types";
import type { ApiCode, ApiResponse } from "../types";
import type { Tag } from "../types/tag";

export interface TagState {
  tags: readonly Tag[];
  loading: boolean;
  /** Code of the last failed call, `null` while everything is fine. */
  error: ApiCode | null;
  refresh: () => Promise<void>;
  /** Creates a tag and answers it, or `null` when the call failed. */
  create: (name: string) => Promise<Tag | null>;
}

/** Runs a command, answering `UNSUPPORTED` outside Tauri so the UI can react the same way. */
async function request<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<ApiResponse<T>> {
  if (!isTauri()) {
    return { code: "UNSUPPORTED", message: command, details: null, data: null };
  }

  return invoke<ApiResponse<T>>(command, args);
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });

    const response = await request<Tag[]>("list_tags");

    if (!isOk(response)) {
      set({ loading: false, error: response.code });
      return;
    }

    set({ tags: response.data, loading: false });
  },

  create: async (name) => {
    set({ error: null });

    const response = await request<Tag>("add_tag", { name });

    if (!isOk(response)) {
      set({ error: response.code });
      return null;
    }

    await get().refresh();
    return response.data;
  },
}));
