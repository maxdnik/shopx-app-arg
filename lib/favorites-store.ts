import AsyncStorage from "@react-native-async-storage/async-storage";
import { ShopXProduct } from "./api";

const FAVORITES_KEY = "SHOPX_FAVORITES_V1";

type FavoritesListener = () => void;

const favoritesListeners = new Set<FavoritesListener>();

export function subscribeToFavoritesChanges(listener: FavoritesListener) {
  favoritesListeners.add(listener);

  return () => {
    favoritesListeners.delete(listener);
  };
}

function notifyFavoritesChanged() {
  favoritesListeners.forEach((listener) => listener());
}

export function getFavoriteProductKey(product: ShopXProduct) {
  return (
    product.slug ||
    product._id ||
    product.id ||
    product.externalId ||
    product.title
  );
}

export async function getFavoriteProducts(): Promise<ShopXProduct[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.log("ERROR GET FAVORITES:", error);
    return [];
  }
}

export async function getFavoritesCount() {
  try {
    const favorites = await getFavoriteProducts();
    return favorites.length;
  } catch (error) {
    console.log("ERROR GET FAVORITES COUNT:", error);
    return 0;
  }
}

export async function isFavoriteProduct(product: ShopXProduct) {
  try {
    const favorites = await getFavoriteProducts();
    const productKey = getFavoriteProductKey(product);

    return favorites.some(
      (favorite) => getFavoriteProductKey(favorite) === productKey
    );
  } catch (error) {
    console.log("ERROR IS FAVORITE:", error);
    return false;
  }
}

export async function addFavoriteProduct(product: ShopXProduct) {
  try {
    const favorites = await getFavoriteProducts();
    const productKey = getFavoriteProductKey(product);

    const alreadyExists = favorites.some(
      (favorite) => getFavoriteProductKey(favorite) === productKey
    );

    if (alreadyExists) return favorites;

    const nextFavorites = [product, ...favorites];

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(nextFavorites));
    notifyFavoritesChanged();

    return nextFavorites;
  } catch (error) {
    console.log("ERROR ADD FAVORITE:", error);
    throw error;
  }
}

export async function removeFavoriteProduct(product: ShopXProduct) {
  try {
    const favorites = await getFavoriteProducts();
    const productKey = getFavoriteProductKey(product);

    const nextFavorites = favorites.filter(
      (favorite) => getFavoriteProductKey(favorite) !== productKey
    );

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(nextFavorites));
    notifyFavoritesChanged();

    return nextFavorites;
  } catch (error) {
    console.log("ERROR REMOVE FAVORITE:", error);
    return [];
  }
}

export async function toggleFavoriteProduct(product: ShopXProduct) {
  try {
    const favorite = await isFavoriteProduct(product);

    if (favorite) {
      return removeFavoriteProduct(product);
    }

    return addFavoriteProduct(product);
  } catch (error) {
    console.log("ERROR TOGGLE FAVORITE:", error);
    return getFavoriteProducts();
  }
}

export async function clearFavorites() {
  await AsyncStorage.removeItem(FAVORITES_KEY);
  notifyFavoritesChanged();
}