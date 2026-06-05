import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ShopXProduct } from "../lib/api";
import {
  getFavoriteProducts,
  getFavoritesCount,
  isFavoriteProduct,
  subscribeToFavoritesChanges,
  toggleFavoriteProduct,
} from "../lib/favorites-store";

export function useFavorites() {
  const [favorites, setFavorites] = useState<ShopXProduct[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  const refreshFavorites = useCallback(async () => {
    try {
      const [items, count] = await Promise.all([
        getFavoriteProducts(),
        getFavoritesCount(),
      ]);

      setFavorites(items);
      setFavoritesCount(count);
    } catch (error) {
      console.log("ERROR REFRESH FAVORITES:", error);
      setFavorites([]);
      setFavoritesCount(0);
    } finally {
      setLoadingFavorites(false);
    }
  }, []);

  useEffect(() => {
    refreshFavorites();

    const unsubscribe = subscribeToFavoritesChanges(() => {
      refreshFavorites();
    });

    return unsubscribe;
  }, [refreshFavorites]);

  useFocusEffect(
    useCallback(() => {
      refreshFavorites();
    }, [refreshFavorites])
  );

  return {
    favorites,
    favoritesCount,
    loadingFavorites,
    refreshFavorites,
  };
}

export function useFavoriteProduct(product?: ShopXProduct | null) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [updatingFavorite, setUpdatingFavorite] = useState(false);

  const refreshFavoriteState = useCallback(async () => {
    if (!product) {
      setIsFavorite(false);
      return;
    }

    const result = await isFavoriteProduct(product);
    setIsFavorite(result);
  }, [product]);

  useEffect(() => {
    refreshFavoriteState();

    const unsubscribe = subscribeToFavoritesChanges(() => {
      refreshFavoriteState();
    });

    return unsubscribe;
  }, [refreshFavoriteState]);

  useFocusEffect(
    useCallback(() => {
      refreshFavoriteState();
    }, [refreshFavoriteState])
  );

  const toggleFavorite = useCallback(async () => {
    if (!product || updatingFavorite) return;

    setUpdatingFavorite(true);

    try {
      await toggleFavoriteProduct(product);
      await refreshFavoriteState();
    } catch (error) {
      console.log("ERROR TOGGLE FAVORITE HOOK:", error);
    } finally {
      setUpdatingFavorite(false);
    }
  }, [product, refreshFavoriteState, updatingFavorite]);

  return {
    isFavorite,
    updatingFavorite,
    toggleFavorite,
    refreshFavoriteState,
  };
}