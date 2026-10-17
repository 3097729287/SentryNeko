// Checks that every offered locale carries the same translation keys.
//
// CONTRIBUTING.md requires a new user-visible string to land in both locale files in the
// same commit; this script turns that rule into something `pnpm lint` can enforce.
// Reserved tags (`ja-JP`, T30) are skipped until they are complete.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n", "locales");
const COMPARED_TAGS = ["en-US", "zh-CN"];

/** Dotted paths of every leaf in a locale file. */
function leafKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}${key}`;

    return child !== null && typeof child === "object" ? leafKeys(child, `${path}.`) : [path];
  });
}

function readKeys(tag) {
  const file = join(LOCALES_DIR, `${tag}.json`);

  return new Set(leafKeys(JSON.parse(readFileSync(file, "utf8"))));
}

const [referenceTag, ...otherTags] = COMPARED_TAGS;
const reference = readKeys(referenceTag);
const problems = [];

for (const tag of otherTags) {
  const keys = readKeys(tag);

  for (const key of reference) {
    if (!keys.has(key)) {
      problems.push(`${tag}.json is missing "${key}"`);
    }
  }

  for (const key of keys) {
    if (!reference.has(key)) {
      problems.push(`${referenceTag}.json is missing "${key}"`);
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }

  process.exitCode = 1;
} else {
  console.log(`locale keys match: ${COMPARED_TAGS.join(" / ")} (${reference.size} keys)`);
}
