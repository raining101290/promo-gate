import type { GuideShot } from "@/lib/help/types";

/** Screenshots live in public/guide/shots and are made by `npm run guide:shots` (tests/guide). */
const SHOTS = "/guide/shots";

export const phoneShot = (name: string, alt: string): GuideShot => ({ src: `${SHOTS}/${name}.jpg`, alt, device: "phone" });
export const deskShot = (name: string, alt: string): GuideShot => ({ src: `${SHOTS}/${name}.jpg`, alt, device: "desktop" });
/** A printed item (standee, cashier guide): captured as an element, so it carries its own size. */
export const printShot = (name: string, alt: string, w: number, h: number): GuideShot => ({ src: `${SHOTS}/${name}.jpg`, alt, device: "print", w, h });
