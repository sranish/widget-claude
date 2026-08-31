import { registerRootComponent } from "expo";
import { Platform } from "react-native";

import App from "./App";

registerRootComponent(App);

// Widget task handler needs the native module — absent in Expo Go, so guard it.
if (Platform.OS === "android") {
  try {
    const { registerWidgetTaskHandler } = require("react-native-android-widget");
    const { widgetTaskHandler } = require("./widgets/widget-task-handler");
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Running in Expo Go — home-screen widget unavailable, in-app preview still works.
  }
}
