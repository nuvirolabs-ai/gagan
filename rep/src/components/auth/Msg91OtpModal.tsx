import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { MSG91_CONFIG, extractMsg91Token } from "./msg91Config";

export { MSG91_CONFIG, extractMsg91Token };

interface Msg91OtpModalProps {
  visible: boolean;
  onClose: () => void;
  phone?: string;
  onSuccess: (token: string, rawData?: unknown) => void;
  onFailure?: (error: unknown) => void;
}

export function Msg91OtpModal({
  visible,
  onClose,
  phone,
  onSuccess,
  onFailure,
}: Msg91OtpModalProps) {
  const normalizedPhone = phone ? phone.replace(/\D/g, "") : "";
  const identifier = normalizedPhone.length === 10 ? `91${normalizedPhone}` : normalizedPhone;

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    // Web platform execution
    const win = window as any;
    win.configuration = {
      widgetId: MSG91_CONFIG.widgetId,
      tokenAuth: MSG91_CONFIG.tokenAuth,
      identifier: identifier || undefined,
      exposeMethods: false,
      success: (data: unknown) => {
        const token = extractMsg91Token(data);
        if (token) {
          onSuccess(token, data);
        } else {
          onFailure?.(data);
        }
      },
      failure: (error: unknown) => {
        onFailure?.(error);
      },
    };

    let i = 0;
    function attempt() {
      const s = document.createElement("script");
      s.src = MSG91_CONFIG.urls[i];
      s.async = true;
      s.onload = () => {
        if (typeof win.initSendOTP === "function") {
          win.initSendOTP(win.configuration);
        }
      };
      s.onerror = () => {
        i++;
        if (i < MSG91_CONFIG.urls.length) {
          attempt();
        }
      };
      document.head.appendChild(s);
    }
    attempt();
  }, [visible, identifier, onSuccess, onFailure]);

  if (!visible) return null;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <base href="https://control.msg91.com/app/">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #FAFAF8;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    #loading {
      color: #165A31;
      font-size: 15px;
      font-weight: 600;
      text-align: center;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div id="loading">Connecting to MSG91 Secure OTP...</div>
  <script type="text/javascript">
  var configuration = {
    widgetId: "${MSG91_CONFIG.widgetId}",
    tokenAuth: "${MSG91_CONFIG.tokenAuth}",
    identifier: "${identifier}",
    exposeMethods: false,
    success: function(data) {
      console.log('MSG91 success response', data);
      var msg = JSON.stringify({ type: 'MSG91_SUCCESS', data: data });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      }
    },
    failure: function(error) {
      console.log('MSG91 failure reason', error);
      var msg = JSON.stringify({ type: 'MSG91_FAILURE', error: error });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      }
    }
  };
  </script>
  <script type="text/javascript">
  (function loadOtpScript(urls) {
      let i = 0;
      function attempt() {
          const s = document.createElement('script');
          s.src = urls[i];
          s.async = true;
          s.onload = function() {
              var loader = document.getElementById('loading');
              if (loader) loader.style.display = 'none';
              if (typeof window.initSendOTP === 'function') {
                  window.initSendOTP(configuration);
              }
          };
          s.onerror = function() {
              i++;
              if (i < urls.length) {
                  attempt();
              } else {
                var loader = document.getElementById('loading');
                if (loader) loader.innerText = 'Unable to reach MSG91 OTP service. Please check network.';
              }
          };
          document.head.appendChild(s);
      }
      attempt();
  })([
      'https://verify.msg91.com/otp-provider.js',
      'https://verify.phone91.com/otp-provider.js'
  ]);
  </script>
</body>
</html>`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Ionicons name="shield-checkmark" size={20} color="#165A31" style={{ marginRight: 6 }} />
            <Text style={styles.headerTitle}>MSG91 Secure OTP</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close OTP verification">
            <Ionicons name="close" size={22} color="#16241B" />
          </TouchableOpacity>
        </View>

        {Platform.OS === "web" ? (
          <View style={styles.webContainer}>
            <ActivityIndicator size="large" color="#165A31" />
            <Text style={styles.webPrompt}>MSG91 OTP Widget loaded in browser window</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html: htmlContent, baseUrl: "https://control.msg91.com/app/" }}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            allowFileAccess
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#165A31" />
              </View>
            )}
            onMessage={(event) => {
              try {
                const parsed = JSON.parse(event.nativeEvent.data);
                if (parsed.type === "MSG91_SUCCESS") {
                  const token = extractMsg91Token(parsed.data);
                  if (token) {
                    onSuccess(token, parsed.data);
                  } else {
                    onFailure?.(parsed.data);
                  }
                } else if (parsed.type === "MSG91_FAILURE") {
                  onFailure?.(parsed.error);
                }
              } catch (err) {
                console.error("Error parsing MSG91 message:", err);
              }
            }}
            style={styles.webView}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16241B",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  webContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  webPrompt: {
    marginTop: 16,
    fontSize: 15,
    color: "#5D625E",
    fontWeight: "600",
  },
});
