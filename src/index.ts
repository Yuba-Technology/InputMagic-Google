import { eventBus } from "./data/event-bus";
import { keyboardManager } from "./control/keyboard";
import "@/control/player";
import "@/render/render";
import "./data/ai/gemini";
import "./data/panel/inputBar";
import "./render/utility";
import "@assets/scss/index.scss";

keyboardManager.start();
