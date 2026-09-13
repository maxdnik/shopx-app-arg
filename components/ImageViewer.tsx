import { Feather } from "@expo/vector-icons";
import { useEffect } from "react";
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    x.value = 0;
    y.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  }, [index, scale, savedScale, x, y, savedX, savedY]);
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        x.value = savedX.value + event.translationX;
        y.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2.5;
      scale.value = withTiming(next);
      savedScale.value = next;
      x.value = withTiming(0);
      y.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));
  return (
    <Modal
      visible={index !== null}
      onRequestClose={onClose}
      animationType="fade"
    >
      <GestureHandlerRootView style={s.root}>
        <View style={[s.bar, { paddingTop: insets.top + 14 }]}>
          <Text style={s.text}>
            {(index ?? 0) + 1} / {images.length}
          </Text>
          <TouchableOpacity
            accessibilityLabel="Cerrar imagen ampliada"
            onPress={onClose}
            style={s.icon}
          >
            <Feather name="x" color="#FFF" size={28} />
          </TouchableOpacity>
        </View>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[s.stage, style]}>
            {index !== null && images[index] && (
              <Image
                source={{ uri: images[index] }}
                style={s.image}
                resizeMode="contain"
              />
            )}
          </Animated.View>
        </GestureDetector>
        <View style={[s.bar, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            accessibilityLabel="Imagen anterior"
            disabled={!index}
            onPress={() => onIndexChange(Math.max(0, (index ?? 0) - 1))}
            style={s.icon}
          >
            <Feather
              name="chevron-left"
              color={!index ? "#52606E" : "#FFF"}
              size={28}
            />
          </TouchableOpacity>
          <Text style={s.text}>Pellizcá o tocá dos veces para ampliar</Text>
          <TouchableOpacity
            accessibilityLabel="Imagen siguiente"
            disabled={index === images.length - 1}
            onPress={() =>
              onIndexChange(Math.min(images.length - 1, (index ?? 0) + 1))
            }
            style={s.icon}
          >
            <Feather
              name="chevron-right"
              color={index === images.length - 1 ? "#52606E" : "#FFF"}
              size={28}
            />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#071E35" },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#071E35",
    zIndex: 2,
    gap: 4,
  },
  text: { color: "#FFF", fontSize: 12, flexShrink: 1, textAlign: "center" },
  icon: { padding: 10 },
  stage: { flex: 1 },
  image: { width: "100%", height: "100%" },
});
