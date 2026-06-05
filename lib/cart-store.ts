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
    .map(([name, value]) => [String(name || "").trim(), String(value || "").trim()])
    .filter(([name, value]) => name && value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join("|");

  const variantKey = String(
    rawProduct?.selectedVariantId ||
      rawProduct?.selectedVariant?.id ||
      rawProduct?.selectedVariant?.sku ||
      ""
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

export async function addProductToCart(product: ShopXProduct) {
  try {
    const currentCart = await getCartItems();
    const productKey = getProductKey(product);

    const existingIndex = currentCart.findIndex(
      (item) => getProductKey(item.product) === productKey
    );

    let nextCart: CartItem[];

    if (existingIndex >= 0) {
      nextCart = currentCart.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity: Number(item.quantity || 0) + 1,
            }
          : item
      );
    } else {
      nextCart = [
        ...currentCart,
        {
          product,
          quantity: 1,
          addedAt: new Date().toISOString(),
        },
      ];
    }

    await AsyncStorage.setItem(CART_KEY, JSON.stringify(nextCart));
    notifyCartChanged();

    return nextCart;
  } catch (error) {
    console.log("ERROR ADD CART:", error);
    throw error;
  }
}

export async function updateCartItemQuantity(
  product: ShopXProduct,
  quantity: number
) {
  try {
    const currentCart = await getCartItems();
    const productKey = getProductKey(product);

    const nextCart =
      quantity <= 0
        ? currentCart.filter(
            (item) => getProductKey(item.product) !== productKey
          )
        : currentCart.map((item) =>
            getProductKey(item.product) === productKey
              ? {
                  ...item,
                  quantity,
                }
              : item
          );

    await AsyncStorage.setItem(CART_KEY, JSON.stringify(nextCart));
    notifyCartChanged();

    return nextCart;
  } catch (error) {
    console.log("ERROR UPDATE CART:", error);
    return [];
  }
}

export async function removeProductFromCart(product: ShopXProduct) {
  try {
    const currentCart = await getCartItems();
    const productKey = getProductKey(product);

    const nextCart = currentCart.filter(
      (item) => getProductKey(item.product) !== productKey
    );

    await AsyncStorage.setItem(CART_KEY, JSON.stringify(nextCart));
    notifyCartChanged();

    return nextCart;
  } catch (error) {
    console.log("ERROR REMOVE CART:", error);
    return [];
  }
}

export async function clearCart() {
  await AsyncStorage.removeItem(CART_KEY);
  notifyCartChanged();
}