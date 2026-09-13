import AsyncStorage from "@react-native-async-storage/async-storage";
import { ShopXProduct } from "./api";

const CART_KEY = "SHOPX_CART_V1";

export type CartItem = {
  product: ShopXProduct;
  quantity: number;
  addedAt: string;
};

type CartListener = () => void;

const cartListeners = new Set<CartListener>();

export function subscribeToCartChanges(listener: CartListener) {
  cartListeners.add(listener);

  return () => {
    cartListeners.delete(listener);
  };
}

function notifyCartChanged() {
  cartListeners.forEach((listener) => listener());
}

function getSelectionKey(product: ShopXProduct) {
  const rawProduct = product as any;
  const selectedOptions = rawProduct?.selectedOptions || {};

  const optionKey = Object.entries(selectedOptions)
    .map(([name, value]) => [
      String(name || "").trim(),
      String(value || "").trim(),
    ])
    .filter(([name, value]) => name && value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join("|");

  const variantKey = String(
    rawProduct?.selectedVariantId ||
      rawProduct?.selectedVariant?.id ||
      rawProduct?.selectedVariant?.sku ||
      "",
  ).trim();

  return optionKey || variantKey;
}

export function getProductKey(product: ShopXProduct) {
  const baseKey =
    product.slug ||
    product._id ||
    product.id ||
    product.externalId ||
    product.title;

  const selectionKey = getSelectionKey(product);

  return selectionKey ? `${baseKey}__${selectionKey}` : baseKey;
}

export async function getCartItems(): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.log("ERROR GET CART:", error);
    return [];
  }
}

export async function getCartCount() {
  try {
    const cartItems = await getCartItems();

    return cartItems.reduce((total, item) => {
      return total + Number(item.quantity || 0);
    }, 0);
  } catch (error) {
    console.log("ERROR GET CART COUNT:", error);
    return 0;
  }
}

// Serialize read/modify/write operations so fast taps cannot drop cart lines.
let cartMutation: Promise<unknown> = Promise.resolve();
function mutateCart<T>(operation: () => Promise<T>): Promise<T> {
  const next = cartMutation.then(operation, operation);
  cartMutation = next.catch(() => undefined);
  return next;
}
export function addProductToCart(product: ShopXProduct) {
  return addProductsToCart([{ product, quantity: 1 }]);
}
export function addProductsToCart(
  incoming: { product: ShopXProduct; quantity: number }[],
) {
  return mutateCart(async () => {
    const next = await getCartItems();
    for (const { product, quantity } of incoming) {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3)
        throw new Error(
          "Podés comprar hasta tres unidades del mismo producto.",
        );
      const index = next.findIndex(
        (item) => getProductKey(item.product) === getProductKey(product),
      );
      if (index >= 0) {
        const total = next[index].quantity + quantity;
        if (total > 3)
          throw new Error(
            "El carrito admite hasta tres unidades del mismo producto. Revisá las cantidades.",
          );
        next[index] = { ...next[index], product, quantity: total };
      } else
        next.push({ product, quantity, addedAt: new Date().toISOString() });
    }
    if (next.length > 10)
      throw new Error("El carrito admite hasta diez productos por operación.");
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
    notifyCartChanged();
    return next;
  });
}

export async function updateCartItemQuantity(
  product: ShopXProduct,
  quantity: number,
) {
  return mutateCart(async () => {
    const currentCart = await getCartItems();
    const productKey = getProductKey(product);

    const nextCart =
      quantity <= 0
        ? currentCart.filter(
            (item) => getProductKey(item.product) !== productKey,
          )
        : currentCart.map((item) =>
            getProductKey(item.product) === productKey
              ? {
                  ...item,
                  quantity,
                }
              : item,
          );

    if (!Number.isInteger(quantity) || quantity > 3)
      throw new Error("Podés comprar hasta tres unidades del mismo producto.");
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(nextCart));
    notifyCartChanged();

    return nextCart;
  });
}

export async function removeProductFromCart(product: ShopXProduct) {
  return mutateCart(async () => {
    const currentCart = await getCartItems();
    const productKey = getProductKey(product);

    const nextCart = currentCart.filter(
      (item) => getProductKey(item.product) !== productKey,
    );

    await AsyncStorage.setItem(CART_KEY, JSON.stringify(nextCart));
    notifyCartChanged();

    return nextCart;
  });
}

export async function clearCart() {
  return mutateCart(async () => {
    await AsyncStorage.removeItem(CART_KEY);
    notifyCartChanged();
  });
}
