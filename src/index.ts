import "@assets/scss/index.scss";
import "bootstrap/scss/bootstrap.scss";
import "bootstrap/js/index.esm.js";
import { keyboardManager } from "./control/keyboard";
import "@/control/player";
import "@/render/render";
import "./data/ai/gemini";
import "./render/utility";
import "./data/panel/inputBar";

keyboardManager.start();
console.log("Game started!");
