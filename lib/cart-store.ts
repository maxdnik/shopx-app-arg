import AsyncStorage from "@react-native-async-storage/async-storage";
import { ShopXProduct } from "./api";

const CART_KEY = "SHOPX_CART_V1";

export type CartItem = {
  product: ShopXProduct;
  quantity: number;
  addedAt: string;
};

export function getProductKey(product: ShopXProduct) {
  return (
    product.slug ||
    product._id ||
    product.id ||
    product.externalId ||
    product.title
  );
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
              quantity: item.quantity + 1,
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

    return nextCart;
  } catch (error) {
    console.log("ERROR REMOVE CART:", error);
    return [];
  }
}

export async function clearCart() {
  await AsyncStorage.removeItem(CART_KEY);
}