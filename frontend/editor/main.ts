import { createApp } from "vue";

import App from "./App.vue";
import { applyCssTokens } from "./tokens.ts";
import "./styles.css";

applyCssTokens();
createApp(App).mount("#app");
