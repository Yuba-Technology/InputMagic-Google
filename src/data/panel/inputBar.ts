import { blockMaker } from "../ai/gemini";
import render from "@/render/render";

async function newBlock() {
    const inputbar = document.getElementById("form1") as HTMLInputElement;
    const request: string = inputbar.value;
    inputbar.value = "loading.....";

    try {
        const result = await blockMaker(request);
        inputbar.value = " ";
        console.log(result);
        render.addNewBlockType(result);
    } catch (error) {
        console.error("Error making block:", error);
    }
}

export { newBlock };
