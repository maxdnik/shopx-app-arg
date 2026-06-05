import { buildApiUrl } from "./config";

export type ShopXStore = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  color: string;
  searchQuery?: string;
  sortOrder?: number;
};

export const FALLBACK_STORES: ShopXStore[] = [
  { id: "lego", name: "LEGO", slug: "lego", logo: "https://upload.wikimedia.org/wikipedia/commons/2/24/LEGO_logo.svg", color: "#FFCF00", searchQuery: "LEGO" },
  { id: "apple", name: "Apple", slug: "apple", logo: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg", color: "#A2AAAD", searchQuery: "Apple" },
  { id: "nike", name: "Nike", slug: "nike", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg", color: "#111111", searchQuery: "Nike" },
  { id: "filson", name: "Filson", slug: "filson", logo: "https://www.shopx-ar.com/logos/filson.png", color: "#2E2E2E", searchQuery: "Filson" },
  { id: "yeti", name: "YETI", slug: "yeti", logo: "https://www.shopx-ar.com/logos/yeti.png", color: "#005595", searchQuery: "YETI" },
  { id: "amazon", name: "Amazon", slug: "amazon", logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg", color: "#FF9900", searchQuery: "Amazon" },
  { id: "pandora", name: "Pandora", slug: "pandora", logo: "https://www.shopx-ar.com/logos/pandora.png", color: "#000000", searchQuery: "Pandora" },
  { id: "adidas", name: "Adidas", slug: "adidas", logo: "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg", color: "#000000", searchQuery: "Adidas" },
  { id: "north-face", name: "The North Face", slug: "north-face", logo: "https://www.shopx-ar.com/logos/The_North_Face.png", color: "#C8102E", searchQuery: "The North Face" },
];

export async function getOfficialStores(): Promise<ShopXStore[]> {
  try {
    const response = await fetch(buildApiUrl("/api/app/stores"));

    if (!response.ok) {
      return FALLBACK_STORES;
    }

    const data = await response.json();

    if (!data?.ok || !Array.isArray(data.stores)) {
      return FALLBACK_STORES;
    }

    return data.stores.filter((store: ShopXStore) => store?.slug && store?.name);
  } catch (error) {
    console.log("ERROR OFFICIAL STORES:", error);
    return FALLBACK_STORES;
  }
}
