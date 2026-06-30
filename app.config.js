// app.config.js
// Dynamic Expo config para que TestFlight no vuelva a salir con un OAuth iOS Client ID inválido.
//
// Antes de generar el build de producción cargá estas variables en EAS:
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<OAuth Client ID iOS real de Google Cloud>
// EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID=<Reversed Client ID, ej. com.googleusercontent.apps.935...>
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<OAuth Client ID Web usado por el backend>

const base = require("./app.json");

const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

function clean(value) {
  return String(value || "").trim();
}

function reverseGoogleClientId(clientId) {
  const cleanClientId = clean(clientId).replace(/\.apps\.googleusercontent\.com$/, "");
  return cleanClientId ? `com.googleusercontent.apps.${cleanClientId}` : "";
}

module.exports = ({ config }) => {
  const expo = base.expo || {};

  const googleWebClientId =
    clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
    clean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) ||
    clean(process.env.GOOGLE_CLIENT_ID) ||
    "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com";

  const googleIosClientId = clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const googleIosReverseClientId =
    clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID) ||
    reverseGoogleClientId(googleIosClientId);

  const isEasBuild = process.env.EAS_BUILD === "true" || process.env.EAS_BUILD === "1";

  if (isEasBuild) {
    if (!googleIosClientId) {
      throw new Error(
        "Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. Create an iOS OAuth Client in Google Cloud for bundle id com.maximodimnik.shopx and add it to EAS before building."
      );
    }

    if (!googleIosClientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
      throw new Error("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID has an invalid format.");
    }

    if (!googleIosReverseClientId) {
      throw new Error("Missing EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID.");
    }
  }

  const schemes = ["shopxapp", googleIosReverseClientId].filter(Boolean);

  const infoPlist = {
    ...(expo.ios?.infoPlist || {}),
    ITSAppUsesNonExemptEncryption: false,
    CFBundleURLTypes: [
      {
        CFBundleURLSchemes: schemes,
      },
    ],
  };

  if (googleIosClientId) {
    infoPlist.GIDClientID = googleIosClientId;
  } else {
    delete infoPlist.GIDClientID;
  }

  if (googleWebClientId) {
    infoPlist.GIDServerClientID = googleWebClientId;
  } else {
    delete infoPlist.GIDServerClientID;
  }

  const plugins = (expo.plugins || []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== "@react-native-google-signin/google-signin";
  });

  if (googleIosReverseClientId) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: googleIosReverseClientId,
      },
    ]);
  }

  return {
    ...config,
    ...expo,
    scheme: schemes,
    ios: {
      ...(expo.ios || {}),
      bundleIdentifier: "com.maximodimnik.shopx",
      infoPlist,
    },
    plugins,
  };
};
