/**
 * Cell type registry — skeleton.
 *
 * Every key is currently the NOT_IMPLEMENTED Proxy. Stage 3 slices (S8–S14)
 * replace each key with the real per-type definition imported from
 * `components/cells/<type>/def.ts`.
 *
 * IMPORTANT for Stage 3 slice authors: edit ONLY the keys your slice owns.
 * Keep one key per line so parallel-slice diffs do not conflict.
 */

import { checkboxType } from "@/components/cells/checkbox/def";
import { countryType } from "@/components/cells/country/def";
import { currencyType } from "@/components/cells/currency/def";
import { dateType } from "@/components/cells/date/def";
import { emailType } from "@/components/cells/email/def";
import { fileType } from "@/components/cells/file/def";
import { linkType } from "@/components/cells/link/def";
import { longTextType } from "@/components/cells/long_text/def";
import { numberType } from "@/components/cells/number/def";
import { personType } from "@/components/cells/person/def";
import { phoneType } from "@/components/cells/phone/def";
import { priorityType } from "@/components/cells/priority/def";
import { ratingType } from "@/components/cells/rating/def";
import { statusType } from "@/components/cells/status/def";
import { tagsType } from "@/components/cells/tags/def";
import { textType } from "@/components/cells/text/def";
import { timelineType } from "@/components/cells/timeline/def";
import { voteType } from "@/components/cells/vote/def";
import { weekType } from "@/components/cells/week/def";
import type { CellTypeDef, CellTypeId } from "./types";

/**
 * Sentinel used for cell types that have not yet been implemented.
 * Accessing any property throws a descriptive error at runtime rather
 * than silently returning undefined.
 */
const NOT_IMPLEMENTED = new Proxy({} as CellTypeDef<unknown, unknown>, {
  get(_target, prop) {
    throw new Error(
      `cellRegistry: type not yet implemented (accessing property "${String(prop)}")`,
    );
  },
});

// biome-ignore lint/suspicious/noExplicitAny: registry holds heterogeneous per-type defs; each CellTypeDef uses its own TValue/TConfig — any is intentional here.
export const cellRegistry: Record<CellTypeId, CellTypeDef<any, any>> = {
  text: textType,
  long_text: longTextType,
  status: statusType,
  priority: priorityType,
  person: personType,
  date: dateType,
  timeline: timelineType,
  number: numberType,
  currency: currencyType,
  checkbox: checkboxType,
  file: fileType,
  link: linkType,
  tags: tagsType,
  rating: ratingType,
  email: emailType,
  phone: phoneType,
  country: countryType,
  vote: voteType,
  week: weekType,
  location: NOT_IMPLEMENTED,
  updated_by: NOT_IMPLEMENTED,
  created_by: NOT_IMPLEMENTED,
  created_at_col: NOT_IMPLEMENTED,
  formula: NOT_IMPLEMENTED,
};

/** Look up a cell type definition by its string id. */
// biome-ignore lint/suspicious/noExplicitAny: same rationale as cellRegistry — callers narrow the type at usage site.
export function getCellDef(type: CellTypeId): CellTypeDef<any, any> {
  return cellRegistry[type];
}
