import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Product } from "@/lib/models/Product";
import { Settings } from "@/lib/models/Settings";
import { calculateCartPricing, PRICING_CONFIG_DEFAULT } from "@/lib/pricing-engine";
import { buildPublicPricingItem, getPublicBasePriceUSD } from "@/lib/product-public-price";

export const revalidate = 60;

const SECTION_KEYS = ["clothing", "technology", "toys", "outdoor"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const MAX_FINAL_PRICE_USD = 350;
const MAX_PRODUCTS_PER_SECTION = 10;

const PRODUCT_FIELDS =
  "title priceUSD store brand vendor images slug category weight weightKg dimensionsCm source sourceUrl options shopifyVariants variations homePlacement homeOrder updatedAt";

function normalizeProduct(product: any, pricingSettings: any) {
  const image = product.images?.[0] || "/placeholder.png";
  const basePriceUSD = getPublicBasePriceUSD(product);
  const pricing = calculateCartPricing(
    [buildPublicPricingItem(product, basePriceUSD)],
    pricingSettings,
  );

  const category =
    typeof product.category === "object"
      ? product.category?.leaf || product.category?.sub || product.category?.main || "General"
      : product.category || "General";

  return {
    ...product,
    _id: product._id?.toString(),
    id: product._id?.toString(),
    category,
    categoryData: product.category,
    image,
    images: product.images || [image],
    priceUSD: basePriceUSD,
    estimatedUSD: pricing.totalFinal,
    finalPriceUSD: pricing.totalFinal,
    pricing: {
      finalUSD: pricing.totalFinal,
      totalFinal: pricing.totalFinal,
      totalWeightKg: pricing.totalWeightKg,
      billableWeightKg: pricing.billableWeightKg,
      isWeightImputed: pricing.isWeightImputed,
      breakdown: pricing.breakdown,
    },
  };
}

export async function GET() {
  try {
    await dbConnect();

    const [pricingSettingsDocument, selectedProducts] = await Promise.all([
      Settings.findOne({ key: "pricing_config" }).lean(),
      Product.find({
        homePlacement: { $in: SECTION_KEYS },
        source: { $ne: "ebay" },
        "images.0": { $exists: true },
      })
        .select(PRODUCT_FIELDS)
        .sort({ homePlacement: 1, homeOrder: 1, updatedAt: -1 })
        .limit(80)
        .lean(),
    ]);

    const pricingSettings = (pricingSettingsDocument as any) || PRICING_CONFIG_DEFAULT;
    const sections: Record<SectionKey, any[]> = {
      clothing: [],
      technology: [],
      toys: [],
      outdoor: [],
    };

    for (const rawProduct of selectedProducts as any[]) {
      const section = rawProduct.homePlacement as SectionKey;
      if (!SECTION_KEYS.includes(section)) continue;
      if (sections[section].length >= MAX_PRODUCTS_PER_SECTION) continue;

      const product = normalizeProduct(rawProduct, pricingSettings);
      const finalPrice = Number(product.estimatedUSD || product.finalPriceUSD || 0);

      if (!Number.isFinite(finalPrice) || finalPrice <= 0 || finalPrice > MAX_FINAL_PRICE_USD) {
        continue;
      }

      sections[section].push(product);
    }

    return NextResponse.json(
      {
        ok: true,
        sections,
        maxFinalPriceUSD: MAX_FINAL_PRICE_USD,
        counts: Object.fromEntries(
          Object.entries(sections).map(([key, products]) => [key, products.length]),
        ),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error: any) {
    console.error("ERROR /api/app/home-sections:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudieron cargar las secciones del home." },
      { status: 500 },
    );
  }
}
