import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "../hooks/useNotifications";
import {
  clearNotifications,
  deleteNotification,
  ShopXNotification,
  ShopXNotificationType,
} from "../lib/notifications-store";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const border = "#E2E8F0";
const white = "#FFFFFF";
const orange = "#F59E0B";
const green = "#0EA371";
const red = "#EF4444";

function getNotificationIcon(type: ShopXNotificationType) {
  if (type === "order") return "package-variant-closed";
  if (type === "promo") return "tag-outline";
  if (type === "favorite") return "heart-outline";
  if (type === "cart") return "cart-outline";
  if (type === "system") return "shield-account-outline";

  return "bell-outline";
}

function getNotificationLabel(type: ShopXNotificationType) {
  if (type === "order") return "Pedido";
  if (type === "promo") return "Promoción";
  if (type === "favorite") return "Favoritos";
  if (type === "cart") return "Carrito";
  if (type === "system") return "Sistema";

  return "General";
}

function getNotificationColor(type: ShopXNotificationType) {
  if (type === "order") return navy;
  if (type === "promo") return orange;
  if (type === "favorite") return red;
  if (type === "cart") return accent;
  if (type === "system") return green;

  return navy;
}

function formatNotificationDate(date: string) {
  const createdAt = new Date(date);
  const now = new Date();

  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return createdAt.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

function NotificationCard({
  notification,
  onPress,
  onDelete,
}: {
  notification: ShopXNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const icon = getNotificationIcon(notification.type);
  const label = getNotificationLabel(notification.type);
  const color = getNotificationColor(notification.type);

  return (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !notification.read && styles.notificationCardUnread,
      ]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={[styles.notificationIcon, { backgroundColor: `${color}14` }]}>
        <MaterialCommunityIcons name={icon as any} size={25} color={color} />
      </View>

      <View style={styles.notificationBody}>
        <View style={styles.notificationTopRow}>
          <View style={styles.notificationMeta}>
            <Text style={[styles.notificationType, { color }]}>{label}</Text>

            {notification.priority === "high" ? (
              <View style={styles.priorityPill}>
                <Text style={styles.priorityText}>IMPORTANTE</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.notificationDate}>
            {formatNotificationDate(notification.createdAt)}
          </Text>
        </View>

        <Text style={styles.notificationTitle}>{notification.title}</Text>

        <Text style={styles.notificationMessage}>{notification.message}</Text>

        <View style={styles.notificationFooter}>
          {notification.actionLabel ? (
            <View style={styles.actionPill}>
              <Text style={styles.actionPillText}>
                {notification.actionLabel}
              </Text>
              <Feather name="arrow-right" size={14} color={accent} />
            </View>
          ) : (
            <View />
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            activeOpacity={0.85}
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Feather name="trash-2" size={16} color="#9AA6B8" />
          </TouchableOpacity>
        </View>
      </View>

      {!notification.read ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  const {
    notifications,
    unreadCount,
    loadingNotifications,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications({ seedDemo: false });

  async function handleNotificationPress(notification: ShopXNotification) {
    await markAsRead(notification.id);

    if (notification.actionRoute) {
      router.push(notification.actionRoute as any);
    }
  }

  async function handleDeleteNotification(notification: ShopXNotification) {
    Alert.alert(
      "Eliminar notificación",
      "¿Querés eliminar esta notificación?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await deleteNotification(notification.id);
            await refreshNotifications();
          },
        },
      ]
    );
  }

  async function handleClearAll() {
    if (notifications.length === 0) return;

    Alert.alert(
      "Vaciar notificaciones",
      "¿Querés eliminar todas las notificaciones?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Vaciar",
          style: "destructive",
          onPress: async () => {
            await clearNotifications();
            await refreshNotifications();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={25} color={text} />
          </TouchableOpacity>

          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>Notificaciones</Text>
            <Text style={styles.headerSubtitle}>
              Pedidos, promociones y avisos de ShopX
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.clearButton,
              notifications.length === 0 && styles.clearButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={notifications.length === 0}
            onPress={handleClearAll}
          >
            <Feather
              name="trash-2"
              size={18}
              color={notifications.length === 0 ? "#AAB7C6" : text}
            />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={[navyDark, navy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryIcon}>
            <MaterialCommunityIcons name="bell-outline" size={25} color={navy} />
          </View>

          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryTitle}>
              {unreadCount === 0
                ? "Todo leído"
                : unreadCount === 1
                ? "1 notificación nueva"
                : `${unreadCount} notificaciones nuevas`}
            </Text>

            <Text style={styles.summaryText}>
              Acá vas a ver estados de pedidos, promociones, avisos generales,
              favoritos y carrito.
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.secondaryActionButton,
              unreadCount === 0 && styles.secondaryActionButtonDisabled,
            ]}
            activeOpacity={0.9}
            disabled={unreadCount === 0}
            onPress={markAllAsRead}
          >
            <Feather
              name="check-circle"
              size={17}
              color={unreadCount === 0 ? "#AAB7C6" : navy}
            />
            <Text
              style={[
                styles.secondaryActionText,
                unreadCount === 0 && styles.secondaryActionTextDisabled,
              ]}
            >
              Marcar leídas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionButton}
            activeOpacity={0.9}
            onPress={() => router.push("/categories")}
          >
            <Feather name="shopping-bag" size={17} color={navy} />
            <Text style={styles.secondaryActionText}>Ver productos</Text>
          </TouchableOpacity>
        </View>

        {loadingNotifications ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={navy} />
            <Text style={styles.loadingText}>Cargando notificaciones...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="bell-sleep-outline"
                size={52}
                color={accent}
              />
            </View>

            <Text style={styles.emptyTitle}>No tenés notificaciones</Text>

            <Text style={styles.emptyText}>
              Cuando haya novedades de pedidos, promociones o avisos generales,
              van a aparecer acá.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.9}
              onPress={() => router.push("/categories")}
            >
              <Text style={styles.primaryButtonText}>Explorar productos</Text>
              <Feather name="arrow-right" size={18} color={white} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actividad reciente</Text>

              <Text style={styles.sectionCount}>
                {notifications.length}{" "}
                {notifications.length === 1 ? "aviso" : "avisos"}
              </Text>
            </View>

            <View style={styles.notificationsList}>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                  onDelete={() => handleDeleteNotification(notification)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 45 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: soft,
  },

  screen: {
    flex: 1,
    backgroundColor: soft,
  },

  content: {
    paddingHorizontal: 18,
    paddingBottom: 0,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    color: text,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  headerSubtitle: {
    marginTop: 2,
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },

  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  clearButtonDisabled: {
    opacity: 0.55,
  },

  summaryCard: {
    marginTop: 18,
    borderRadius: 26,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: navy,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },

  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  summaryTextBox: {
    flex: 1,
  },

  summaryTitle: {
    color: white,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  summaryText: {
    color: "#D7E2EF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  actionsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },

  secondaryActionButton: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  secondaryActionButtonDisabled: {
    opacity: 0.58,
  },

  secondaryActionText: {
    color: navy,
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryActionTextDisabled: {
    color: "#AAB7C6",
  },

  loadingBox: {
    marginTop: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },

  emptyBox: {
    marginTop: 22,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    alignItems: "center",

    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },

  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    color: text,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.4,
  },

  emptyText: {
    color: muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },

  primaryButton: {
    height: 48,
    borderRadius: 999,
    backgroundColor: navy,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: white,
    fontSize: 14,
    fontWeight: "900",
  },

  sectionHeader: {
    marginTop: 26,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: text,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  sectionCount: {
    color: accent,
    fontSize: 14,
    fontWeight: "900",
  },

  notificationsList: {
    gap: 12,
  },

  notificationCard: {
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    flexDirection: "row",
    position: "relative",

    shadowColor: navy,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  notificationCardUnread: {
    borderColor: "#BEEFF5",
    backgroundColor: "#FBFEFF",
  },

  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  notificationBody: {
    flex: 1,
    minWidth: 0,
  },

  notificationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },

  notificationMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },

  notificationType: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  priorityPill: {
    height: 20,
    borderRadius: 999,
    backgroundColor: "#FFF7E6",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  priorityText: {
    color: orange,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  notificationDate: {
    color: "#9AA6B8",
    fontSize: 11,
    fontWeight: "800",
  },

  notificationTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },

  notificationMessage: {
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  notificationFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  actionPill: {
    height: 32,
    borderRadius: 999,
    backgroundColor: "#EAFBFD",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  actionPillText: {
    color: navy,
    fontSize: 12,
    fontWeight: "900",
  },

  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },

  unreadDot: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: accent,
  },
});