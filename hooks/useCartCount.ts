import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { getCartCount, subscribeToCartChanges } from "../lib/cart-store";

export function useCartCount() {
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    const count = await getCartCount();
    setCartCount(count);
  }, []);

  useEffect(() => {
    refreshCartCount();

    const unsubscribe = subscribeToCartChanges(() => {
      refreshCartCount();
    });

    return unsubscribe;
  }, [refreshCartCount]);

  useFocusEffect(
    useCallback(() => {
      refreshCartCount();
    }, [refreshCartCount])
  );

  return cartCount;
}