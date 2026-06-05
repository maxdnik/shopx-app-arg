import { ImageSourcePropType } from "react-native";
import { ShopXStore } from "./stores";

const LOGO_BY_SLUG: Record<string, ImageSourcePropType> = {
  apple: require("../assets/store-logos/apple.png"),
  nike: require("../assets/store-logos/nike.png"),
  yeti: require("../assets/store-logos/yeti.png"),
  lego: require("../assets/store-logos/lego.png"),
  amazon: require("../assets/store-logos/amazon.png"),
  adidas: require("../assets/store-logos/adidas.png"),
  filson: require("../assets/store-logos/filson.png"),
  pandora: require("../assets/store-logos/pandora.png"),
  "north-face": require("../assets/store-logos/north-face.png"),
  "the-north-face": require("../assets/store-logos/north-face.png"),
  thenorthface: require("../assets/store-logos/north-face.png"),
  columbia: require("../assets/store-logos/columbia.png"),
  ross: require("../assets/store-logos/ross.png"),
  patagonia: require("../assets/store-logos/patagonia.png"),
  ebay: require("../assets/store-logos/ebay.png"),
  walmart: require("../assets/store-logos/walmart.png"),
  "best-buy": require("../assets/store-logos/best-buy.png"),
  bestbuy: require("../assets/store-logos/best-buy.png"),
  target: require("../assets/store-logos/target.png"),
  "under-armour": require("../assets/store-logos/under-armour.png"),
  underarmour: require("../assets/store-logos/under-armour.png"),
  "new-balance": require("../assets/store-logos/new-balance.png"),
  newbalance: require("../assets/store-logos/new-balance.png"),
};

function normalize(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getStoreLogoSource(slug?: string): ImageSourcePropType | null {
  const cleanSlug = normalize(slug);
  return LOGO_BY_SLUG[cleanSlug] || null;
}

export function canUseRemoteStoreLogo(logo?: string) {
  if (!logo) return false;

  const cleanLogo = logo.toLowerCase().split("?")[0];
  return (
    cleanLogo.endsWith(".png") ||
    cleanLogo.endsWith(".jpg") ||
    cleanLogo.endsWith(".jpeg") ||
    cleanLogo.endsWith(".webp")
  );
}

export function getStoreLogoWordmark(store?: Pick<ShopXStore, "name" | "slug"> | null) {
  const name = String(store?.name || store?.slug || "ShopX").trim();

  if (!name) return "ShopX";
  if (name.length <= 12) return name;

  return name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 4)
    .toUpperCase();
}
