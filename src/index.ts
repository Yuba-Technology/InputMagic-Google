import { eventBus } from "./data/event-bus";
import { keyboardManager } from "./control/keyboard";
import "@/control/player";
import "@/render/render";
import "./data/ai/gemini";
import "./data/panel/inputBar"
import "@assets/scss/index.scss";
import "@assets/scss/_inputBar.scss";

keyboardManager.start();
