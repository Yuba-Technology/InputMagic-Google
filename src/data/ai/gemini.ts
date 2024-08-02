import { GoogleGenerativeAI } from "@google/generative-ai";
import { flattenJson } from "./util";
// Access your API key (see "Set up your API key" above)

// Fetch your API_KEY
const API_KEY: string = "";
// Access your API key (see "Set up your API key" above)
const genAI: GoogleGenerativeAI = new GoogleGenerativeAI(API_KEY);
// Initialize the Gemini model
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
});

// type img= {
//             data: string,
//             mimeType: string,
//     }
//     // this is the standard img format
// const messageMemory:Array<string> = []
// const imgMemory:Array<img> = [];
// // the history to keep track of the user's actions

// function base64ToGenerativePart(image: img): { inlineData: { data: string; mimeType: string } } {
//     return {
//         inlineData: { data: image.data.split(',')[1], mimeType: image.mimeType },
//     };
// }
// const imageParts = imgMemory.map(base64ToGenerativePart);
// const choice = {
//     "newBlock":blockMaker,
//     "badword":badWord,
//     "conversation":conversation,

// }
// function badWord():string{

// }
// async function conversation(request:string,messageMemory:Array<string>,imgMemory:Array<img>){

// }
async function blockMaker(request: string) {
    // Define the prompt
    const prompt: string = `
          we are currently making some sort of sandbox game, and i want you to come up with different blocks.
          i want you to give me 5-8 kinds of blocks in a ${request} occur, and you have to give me:
          blockname + color(in Hex,should be start with "#" form, and should be different for different block) + description(should have a sense of humor,should be interesting).
          When you think it is enough, just stop, you do not have to make 6 kinds of blocks every time.
          I want building blocks more, which are full blocks. Using this JSON schema:
          Recipe = {blockname:{blockcolor:color,blockdes:des},...}, return a json in given format.just json only , no other words
        `;

    // Generate content using the model
    const result = await model.generateContent(prompt, {
        // responseMimeType: "application/json"
    });
    // Get the response text
    const response = await result.response;
    const text1 = response.text().slice(7);
    const text = text1.slice(0, -3);
    const nestedJson: JSON = JSON.parse(text);
    // Transform the response into json form
    const flatJson = flattenJson(nestedJson);

    return flatJson;
}

// async function intentionCheck(request: string):Promise<string> {
//     // Define the prompt
//     const prompt:string = `Now, you are an AI assistant embedded in a sandbox game. You will receive some prompt from user, which is ${request}(this is the prompt!!). You have to do the classification: if this is like 'give comments on what I did', 'am what I build beautiful?' which ask for your comments on the actions, the environment of the sandbox game and other in-game activities, please return 'comment'. If this is like a request to construct some unique stuffs or ask for new kinds of blocks, please return and only return 'newBlock'. If this is kind of casual conversation, return and only return 'conversation'. If this is unfriendly or insulting or just bullshits (pay attention to homophones or other expressions), return and only return 'badword'.`;

//     // Generate content using the model
//     const para = {
//         response_mime_type: "application/json"
//     }
//     const result = await model.generateContent(prompt, para);
//     const response = await result.response.text();
//     return response;
// }

// function reDirect(response:string,request:string,choice:string):void{

// }

// async function envInspect(request:string,img64:string):Promise<string> {
//     const prompt:string = `
// You are a LLM embedded in a sandbox game. You will be presented with an image of the current environment.
// You might have been told this many times. Now you carefully look at the screenshot of the environment we give you,
// and combine it with your memory, respond to the \${request} that the user asks.
// `

//     return response;
// }
// const response: string = await blockMaker("coool kitty");
export { blockMaker };
