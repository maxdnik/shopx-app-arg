import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

const navy = "#062B4F";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const white = "#FFFFFF";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: ReactNode;
  compact?: boolean;
};

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  compact = false,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {icon ? <View style={styles.iconBox}>{icon}</View> : null}

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}

      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 42,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerCompact: {
    paddingTop: 36,
    paddingBottom: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  eyebrow: {
    color: accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    color: text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  titleCompact: {
    fontSize: 31,
    lineHeight: 35,
  },
  subtitle: {
    marginTop: 10,
    color: "#627896",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
});