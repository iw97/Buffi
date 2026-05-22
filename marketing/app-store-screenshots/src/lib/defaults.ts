import { DEFAULT_LOCALE } from "./locale";
import type { Device, ProjectState, Slide } from "./types";

let _id = 0;
export const nid = () => `s_${Date.now().toString(36)}_${(_id++).toString(36)}`;

const en = (s: string) => ({ [DEFAULT_LOCALE]: s });
const shot = (n: string) => `/screenshots/apple/iphone/en/${n}.png`;

function buffiIphoneSlides(): Slide[] {
  return [
    {
      id: nid(),
      layout: "hero",
      label: en("Material Intelligence"),
      headline: en("That $420\ncashmere isn't\ncashmere."),
      screenshot: shot("01-hero"),
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("Scan anything"),
      headline: en("Tag in hand.\nURL in cart.\nTruth in seconds."),
      screenshot: shot("02-scan"),
    },
    {
      id: nid(),
      layout: "device-top",
      label: en("Fiber breakdown"),
      headline: en("78% wool.\n22% nylon.\nSourced from X."),
      screenshot: shot("03-materials"),
      inverted: true,
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("The receipt"),
      headline: en("$18 to make.\n$340 at retail."),
      screenshot: shot("04-markup"),
    },
    {
      id: nid(),
      layout: "hero",
      label: en("Retail Trap"),
      headline: en("You deserved\nto know."),
      screenshot: shot("05-alternatives"),
    },
  ];
}

function fgStarter(): Slide[] {
  return [
    {
      id: nid(),
      layout: "feature-graphic",
      label: {},
      headline: en("Material Intelligence\nfor your wardrobe."),
      screenshot: "",
    },
  ];
}

export const DEFAULT_PROJECT: ProjectState = {
  appName: "Buffi",
  themeId: "buffi-terminal",
  locales: [DEFAULT_LOCALE],
  locale: DEFAULT_LOCALE,
  device: "iphone",
  orientation: "portrait",
  appIcon: "/app-icon.png",
  slidesByDevice: {
    iphone: buffiIphoneSlides(),
    android: buffiIphoneSlides().map((s) => ({ ...s, id: nid() })),
    ipad: buffiIphoneSlides().slice(0, 3).map((s) => ({ ...s, id: nid() })),
    "android-7": buffiIphoneSlides().slice(0, 2).map((s) => ({ ...s, id: nid() })),
    "android-10": buffiIphoneSlides().slice(0, 2).map((s) => ({ ...s, id: nid() })),
    "feature-graphic": fgStarter(),
  },
};

export function newSlide(layout: Slide["layout"] = "device-bottom"): Slide {
  return {
    id: nid(),
    layout,
    label: en("NEW"),
    headline: en("Edit this\nheadline."),
    screenshot: "",
  };
}

export function detectPlatform(device: Device): "ios" | "android" {
  return device === "iphone" || device === "ipad" ? "ios" : "android";
}
