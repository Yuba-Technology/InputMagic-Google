import { eventBus } from "./data/event-bus";
import { keyboardManager } from "./control/keyboard";
import "@/control/player";
import "@/render/render";

keyboardManager.start();
