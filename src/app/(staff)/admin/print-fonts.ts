import { Noto_Sans_Bengali } from "next/font/google";

/** Bangla glyphs for print views (Geist has none). Apply `bangla.className` to Bangla text only. */
export const bangla = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "600"], display: "block" });
