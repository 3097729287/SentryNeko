/** BCP-47 tags the application carries copy for. `ja-JP` arrives with T30. */
export type LanguageCode = "en-US" | "zh-CN" | "ja-JP";

/** A language the interface can offer. */
export interface LanguageOption {
  code: LanguageCode;
  /** The language's own name, so the choice reads the same in every locale. */
  nativeName: string;
  /** Whether copy is complete and the tag may be selected; `ja-JP` is false until T30. */
  available: boolean;
}
