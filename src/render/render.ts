import {
    Application,
    Graphics,
    Sprite,
    Container,
    ContainerChild,
    Texture,
    Ticker,
    Point
} from "pixi.js";
import { isPointInside, Points } from "./utility";
import { inventory } from "./inventory";
import { BlockPos, Block, EmptyBlock } from "@/data/map/block";
import { Chunk } from "@/data/map/chunk";
import { Dimension } from "@/data/map/dimension";
import { Generator3D } from "@/data/map/generator/3d";
import { generate2DArray, traverse3DArray } from "@/data/map/utils";
import { eventBus } from "@/data/event-bus";
import { PlayerMoveEventData } from "@/control/player";

/**
 * !IMPORTANT: The coordinate system used in rendering
 * !is quite different from the one used in the data model!
 * !Please be careful when converting between them.
 *
 * Here is the coordinate system used in rendering:
 *        ------------> x
 *       /|
 *      / |
 *     /  |
 *  z ↙   |
 *        ↓ y
 *
 * However, the coordinate system used in the data model is:
 *
 *      ↑ z
 *      |
 *      |
 *      |
 *      ------------> x
 *     /
 *    /
 *   /
 *  ↙ y
 *
 * And for screen coordinates, which is responsible for final visual rendering:
 *   -------------> x
 *   |
 *   |
 *   |
 *   |
 *   ↓ y
 *
 * The `data model` coordinate system, which is used in the data model, will be converted to the
 * `render` coordinate system, which is used in rendering calculations, and finally to the `screen`
 * coordinate system, which is the same as the computer screen coordinate system.
 *
 * When converting the block position in the data model to the render block position, the following
 * formula should be used:
 * renderBlockPos = { x: blockPos.x, y: renderChunkHeight - 1 - blockPos.z, z: blockPos.y }
 *
 * When converting the render block position to the block position in the data model, the following
 * formula should be used:
 * blockPos = { x: renderBlockPos.x, y: renderChunkHeight - 1 - renderBlockPos.z, z: renderBlockPos.y }
 *
 * @see {@link getRenderFactor} for the conversion between the render block position and the screen position.
 */

const blockSize = 30;
// const blockSize = 40;
const renderChunkHeight = Chunk.HEIGHT;
// const renderChunkSize = 1;
const renderChunkSize = 8;
const chunkSize = 8;
const startPosition = { x: -150, y: -300 };
// const startPosition = { x: 0, y: -500 };

/**
 * The block position type used in rendering.
 * @note Notice that this type is different from the one used in the data model,
 * because different coordinate systems are used in rendering and data model.
 * However, this coordinate is not the same as the final render position.
 */
type RenderBlockPos = {
    x: number;
    z: number;
    y: number;
};

/**
 * The center position of the block in the data model coordinate system, ignoring the z-axis.
 */
type CenterPos = {
    x: number;
    y: number;
};

// this is a datatype for the shape ,with its points for different plane

class ExtendedContainer extends Container {
    indexPos: { x: number; y: number } = { x: 0, y: 0 };

    constructor(indexPos: { x: number; y: number }) {
        super();
        this.indexPos = indexPos;
    }
}
class ExtendedSprite extends Sprite {
    pos: RenderBlockPos;
    containerCenter: { x: number; y: number };

    constructor(
        texture: Texture,
        pos: RenderBlockPos,
        containerCenter: { x: number; y: number }
    ) {
        super(texture);
        this.pos = pos;
        this.containerCenter = containerCenter;
    }
}

function getRenderFactor(pos: RenderBlockPos) {
    // *Magic. Do not touch.
    return {
        x:
            blockSize * pos.x -
            Math.cos((5 / 12) * Math.PI) * blockSize * pos.z,
        y:
            (2 / 3) * blockSize * pos.y +
            Math.sin((5 / 12) * Math.PI) * blockSize * pos.z
    };
}

const keyState = {
    lastKey: null as number | null,
    isActive: false
};

window.addEventListener("keydown", (event) => {
    const key = Number.parseInt(event.key, 10);
    if (key >= 1 && key <= 6) {
        keyState.lastKey = key;
        keyState.isActive = true;
    }
});

window.addEventListener("keyup", (event) => {
    const key = Number.parseInt(event.key, 10);
    if (key >= 1 && key <= 6) {
        keyState.lastKey = null;
        keyState.isActive = false;
    }
});

// function windowToCanvasCoordinates(event: MouseEvent, canvas: HTMLCanvasElement) {
//     const rect = canvas.getBoundingClientRect();
//     const x = event.clientX - rect.left;
//     const y = event.clientY - rect.top;
//     return { x, y };
// }
function extractFirstKey(path: string): string {
    const dotIndex = path.indexOf(".");
    if (dotIndex === -1) {
        return path; // No dot found, return the entire string
    }

    return path.slice(0, dotIndex);
}

function getShapes(
    pos: { x: number; y: number },
    size: { x: number; y: number }
) {
    // pixijs make the pivot of Sprite at the left top, make it tricky
    const orignPoint = { x: pos.x, y: pos.y + size.y };
    const shapes = {
        // magics, these are coordinates of points in this shape
        top: [
            { x: orignPoint.x, y: orignPoint.y - (blockSize * 2) / 3 },
            {
                x: orignPoint.x + blockSize,
                y: orignPoint.y - (blockSize * 2) / 3
            },
            {
                x:
                    orignPoint.x +
                    blockSize +
                    Math.cos((5 / 12) * Math.PI) * blockSize,
                y:
                    orignPoint.y -
                    (blockSize * 2) / 3 -
                    Math.sin((5 / 12) * Math.PI) * blockSize
            },
            {
                x: orignPoint.x + Math.cos((5 / 12) * Math.PI) * blockSize,
                y:
                    orignPoint.y -
                    (blockSize * 2) / 3 -
                    Math.sin((5 / 12) * Math.PI) * blockSize
            }
        ],
        front: [
            { x: orignPoint.x, y: orignPoint.y },
            { x: orignPoint.x + blockSize, y: orignPoint.y },
            {
                x: orignPoint.x + blockSize,
                y: orignPoint.y - (blockSize * 2) / 3
            },
            { x: orignPoint.x, y: orignPoint.y - (blockSize * 2) / 3 }
        ],
        right: [
            { x: orignPoint.x + blockSize, y: orignPoint.y },
            {
                x:
                    orignPoint.x +
                    blockSize +
                    Math.cos((5 / 12) * Math.PI) * blockSize,
                y: orignPoint.y - Math.sin((5 / 12) * Math.PI) * blockSize
            },
            {
                x:
                    orignPoint.x +
                    blockSize +
                    Math.cos((5 / 12) * Math.PI) * blockSize,
                y:
                    orignPoint.y -
                    Math.sin((5 / 12) * Math.PI) * blockSize -
                    (blockSize * 2) / 3
            },
            {
                x: orignPoint.x + blockSize,
                y: orignPoint.y - (blockSize * 2) / 3
            }
        ]
    };

    return shapes;
}

/**
 * Returns the texture points of the block
 * @param sideLength The length of the side of the block, in pixels (px)
 * @returns The texture points of the block
 */
const texturePoints = (sideLength: number) => [
    // the top face
    [
        sideLength * Math.cos((5 / 12) * Math.PI),
        -sideLength * Math.sin((5 / 12) * Math.PI),
        sideLength * Math.cos((5 / 12) * Math.PI) + sideLength,
        -sideLength * Math.sin((5 / 12) * Math.PI),
        sideLength,
        0,
        0,
        0
    ],
    // The block's front face
    [
        0,
        0,
        sideLength,
        0,
        sideLength,
        (sideLength * 2) / 3,
        0,
        (sideLength * 2) / 3
    ],
    // The right face
    [
        sideLength,
        0,
        sideLength + sideLength * Math.cos((5 / 12) * Math.PI),
        -sideLength * Math.sin((5 / 12) * Math.PI),
        sideLength + sideLength * Math.cos((5 / 12) * Math.PI),
        (sideLength * 2) / 3 - sideLength * Math.sin((5 / 12) * Math.PI),
        sideLength,
        (sideLength * 2) / 3
    ]
];
const colorMapper: { [key: string]: string } = {
    stone: "#808080",
    sand: "#f0e68c",
    water: "#0000ff",
    grass: "#00ff00",
    dirt: "#8b4513",
    snow: "#ffffff"
};

for (const key in colorMapper) {
    if (!Object.hasOwn(colorMapper, key)) continue;
    inventory.addItem({
        type: key,
        color: colorMapper[key]
    });
}

let selectedBlockType = "grass";

eventBus.on("inventory:select", (data) => {
    const { type } = data as { type: string; color: string };
    selectedBlockType = type;
});

// const colors = [0xcc2900, 0x990000, 0xff3300];

const colorVariants = (color: string): string[] => {
    if (!/^#[\dA-Fa-f]{6}$/.test(color)) {
        throw new Error("Invalid hex color format");
    }

    // 将16进制颜色转换为RGB
    const r = Number.parseInt(color.slice(1, 3), 16);
    const g = Number.parseInt(color.slice(3, 5), 16);
    const b = Number.parseInt(color.slice(5, 7), 16);

    // 生成变化的颜色
    const variants = [color];
    for (let i = 1; i <= 2; i++) {
        const newR = Math.max(0, r - 30 * (i + 1))
            .toString(16)
            .padStart(2, "0");
        const newG = Math.max(0, g - 30 * (i + 1))
            .toString(16)
            .padStart(2, "0");
        const newB = Math.max(0, b - 30 * (i + 1))
            .toString(16)
            .padStart(2, "0");
        variants.push(`#${newR}${newG}${newB}`);
    }

    return variants;
};

const renderChunkPixiWidth =
    getRenderFactor({ x: 1, y: 0, z: 0 }).x * (renderChunkSize + 1);
const renderChunkPixiHeight =
    getRenderFactor({ x: 0, y: 0, z: 1 }).y * (renderChunkSize + 1);
const xMaxChunkLength =
    Math.ceil(window.innerWidth / renderChunkPixiWidth) + 5;
const yMaxChunkLength =
    Math.ceil(window.innerHeight / renderChunkPixiHeight) + 5;

const offsetX = Math.floor(xMaxChunkLength / 2);
const offsetY = Math.floor(yMaxChunkLength / 2);

const moveFunctions: {
    [key: string]: (stage: Container, time: Ticker) => void;
} = {
    up(stage, time) {
        stage.y += time.deltaTime * 4;
    },
    down(stage, time) {
        stage.y -= time.deltaTime * 4;
    },
    left(stage, time) {
        stage.x += time.deltaTime * 4;
    },
    right(stage, time) {
        stage.x -= time.deltaTime * 4;
    }
};

class Render {
    private static instance: Render;
    app: Application;
    private textures: { [key: string]: Texture } = {};
    /**
     * The render grid, which stores the render chunks, in format [y][x].
     * The x-axis is the horizontal axis, and the y-axis is the vertical axis.
     * Notice that the x-axis is reversed to the screen coordinate system,
     * because it was sorted by z-index, which is reversed to the screen x-axis.
     */
    rengerGrid: ExtendedContainer[][] = [];
    private currentXOffset: number = 0;
    private currentYOffset: number = 0;
    private center: CenterPos = { x: 0, y: 0 };
    private tickerTaskList: ((stage: Container, time: Ticker) => void)[] = [];
    counter = 0;
    counterInterval = 10;
    xMouse = 0;
    yMouse = 0;

    constructor() {
        this.app = new Application({
            antialias: true,
            resolution: window.devicePixelRatio,
            autoDensity: true
        });
        // @ts-expect-error No error!!!!!!!!!
        globalThis.__PIXI_APP__ = this.app;

        eventBus.on("player:move", (data) => {
            this.tickerTaskList = [];
            const { directions } = data as PlayerMoveEventData;
            for (const direction of directions) {
                this.tickerTaskList.push(moveFunctions[direction]);
            }
        });
    }

    reassignIndex(): void {
        for (let i = 0; i < yMaxChunkLength; i++) {
            for (let j = 0; j < xMaxChunkLength; j++) {
                this.rengerGrid[i][j].indexPos = { x: i, y: j };
            }
        }
    }

    private async init() {
        await this.app.init({ background: "#1099bb", resizeTo: window });
        this.app.canvas.addEventListener("mousemove", (e) => {
            this.xMouse = e.clientX;
            this.yMouse = e.clientY;
        });
        this.app.ticker.add((time) => {
            for (const task of this.tickerTaskList) {
                task(this.app.stage, time);
            }

            if (this.willOutOfScreen().includes("top")) {
                this.addTopRow();
            }

            if (this.willOutOfScreen().includes("bottom")) {
                this.addBottomRow();
            }

            if (this.willOutOfScreen().includes("right")) {
                this.addRightColumn();
            }

            if (this.willOutOfScreen().includes("left")) {
                this.addLeftColumn();
            }

            this.reassignIndex();

            // this.getCanvas();
        });
        document.body.append(this.app.canvas);
    }

    static async getInstance() {
        if (!Render.instance) {
            Render.instance = new Render();
            await Render.instance.init();
        }

        return Render.instance;
    }

    // private onMouseMove(event: InteractionEvent) {
    //     this.mousePos.copyFrom(event.data.global);

    //     console.log("Mouse position:", this.mousePos);
    // }

    private createGraphics(color: string, sideLength: number = blockSize) {
        const graphics = new Graphics();
        const points = texturePoints(sideLength);
        const colors = colorVariants(color);
        for (const [i, point] of points.entries()) {
            graphics.beginFill(colors[i]);
            graphics.lineStyle(2, 0x3f3f3f, 1);
            graphics.drawPolygon(point);
            graphics.endFill();
        }

        return graphics;
    }

    private getTexture(color: string) {
        this.textures[color] ||= this.app.renderer.generateTexture(
            this.createGraphics(color)
        );

        return this.textures[color];
    }

    convertBlockPosToRenderBlockPos(blockPos: BlockPos): RenderBlockPos {
        return {
            x: blockPos.x,
            y: renderChunkHeight - 1 - blockPos.z,
            z: blockPos.y
        };
    }

    convertRenderBlockPosToBlockPos(renderBlockPos: RenderBlockPos): BlockPos {
        return {
            x: renderBlockPos.x,
            y: renderChunkHeight - 1 - renderBlockPos.z,
            z: renderBlockPos.y
        };
    }

    private renderBlock(
        color: string,
        pos: RenderBlockPos,
        container: ExtendedContainer,
        chunkCenter: { x: number; y: number }
    ) {
        const sprite = new ExtendedSprite(
            this.getTexture(color),
            pos,
            chunkCenter
        );
        const { x, y } = getRenderFactor(pos);
        sprite.x = startPosition.x + x;
        sprite.y = startPosition.y + y;
        sprite.zIndex = (pos.x + pos.z) * 100000 - pos.y * 10;
        sprite.interactive = true;
        container.addChild(sprite);
        sprite.on("pointerdown", (event) => {
            // // 0 表示左键
            // if (event.data.button === 0) {
            //     const x: number =
            //         sprite.containerCenter.x -
            //         Math.ceil(renderChunkSize / 2) +
            //         pos.x;
            //     const y: number =
            //         sprite.containerCenter.y -
            //         Math.ceil(renderChunkSize / 2) +
            //         pos.z;
            //     const z: number = renderChunkHeight - pos.y - 1;
            //     sprite.parent.removeChild(sprite);
            //     dimension.setBlock({ x, y, z }, new EmptyBlock("air"));
            // }

            if (event.button === 0) {
                console.log(container.indexPos);
                console.log(pos.x, pos.z);
                event.preventDefault();
                const x: number =
                    sprite.containerCenter.x -
                    Math.ceil(renderChunkSize / 2) +
                    pos.x;
                const y: number =
                    sprite.containerCenter.y -
                    Math.ceil(renderChunkSize / 2) +
                    pos.z;
                const z: number = renderChunkHeight - pos.y - 1;
                const absolutePos: { x: number; y: number; z: number } = {
                    x,
                    y,
                    z
                };
                const containerIndex: { x: number; y: number } =
                    container.indexPos;
                // const globalPos: { x: number; y: number } = sprite.toGlobal(
                //     new Point(sprite.x, sprite.y)
                // );
                // const mousePos: { x: number; y: number } = { x:this.xMouse-80 , y:this.yMouse+30 };
                // const shape = getShapes(globalPos,{ x:sprite.width,y:sprite.height });
                // canceled boundary:
                // &&dimension.getBlock({
                //     x: absolutePos.x,
                //     y: (absolutePos.y+1),
                //     z: absolutePos.z
                // })instanceof EmptyBlock
                // &&dimension.getBlock({
                //     x: absolutePos.x,
                //     y: (absolutePos.y-1),
                //     z: absolutePos.z
                // })instanceof EmptyBlock
                // &&dimension.getBlock({
                //     x: absolutePos.x - 1,
                //     y: absolutePos.y,
                //     z: absolutePos.z
                // }) instanceof EmptyBlock
                // &&dimension.getBlock({
                //     x: absolutePos.x + 1,
                //     y: absolutePos.y,
                //     z: absolutePos.z
                // }) instanceof EmptyBlock
                if (keyState.isActive) {
                    switch (keyState.lastKey) {
                        case 1: {
                            if (pos.z + 1 < chunkSize + 1) {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",
                                    { x: pos.x, y: pos.y, z: pos.z + 1 },
                                    container,
                                    chunkCenter
                                );
                            } else {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",
                                    {
                                        x: pos.x,
                                        y: pos.y,
                                        z: (pos.z + 1) % (chunkSize + 1)
                                    },
                                    this.rengerGrid[containerIndex.x + 1][
                                        containerIndex.y
                                    ],
                                    chunkCenter
                                );
                            }

                            dimension.setBlock(
                                {
                                    x: absolutePos.x,
                                    y: absolutePos.y + 1,
                                    z: absolutePos.z
                                },
                                new Block(selectedBlockType)
                            );

                            break;
                        }

                        case 2: {
                            dimension.setBlock(
                                {
                                    x: absolutePos.x,
                                    y: absolutePos.y - 1,
                                    z: absolutePos.z
                                },
                                new Block(selectedBlockType)
                            );
                            if (pos.z - 1 >= 0) {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",
                                    { x: pos.x, y: pos.y, z: pos.z - 1 },
                                    container,
                                    chunkCenter
                                );
                            } else {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",
                                    {
                                        x: pos.x,
                                        y: pos.y,
                                        z: pos.z - 1 + chunkSize + 1
                                    },
                                    this.rengerGrid[containerIndex.x - 1][
                                        containerIndex.y
                                    ],
                                    chunkCenter
                                );
                            }

                            break;
                        }

                        case 3: {
                            if (pos.x - 1 >= 0) {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",
                                    { x: pos.x - 1, y: pos.y, z: pos.z },
                                    container,
                                    chunkCenter
                                );
                            } else {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",
                                    {
                                        x: pos.x - 1 + chunkSize + 1,
                                        y: pos.y,
                                        z: pos.z
                                    },
                                    this.rengerGrid[containerIndex.x][
                                        containerIndex.y - 1
                                    ],
                                    chunkCenter
                                );
                            }

                            dimension.setBlock(
                                {
                                    x: absolutePos.x - 1,
                                    y: absolutePos.y,
                                    z: absolutePos.z
                                },
                                new Block(selectedBlockType)
                            );

                            break;
                        }

                        case 4: {
                            if (pos.x + 1 < chunkSize + 1) {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",

                                    { x: pos.x + 1, y: pos.y, z: pos.z },
                                    container,
                                    chunkCenter
                                );
                            } else {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",

                                    {
                                        x: (pos.x + 1) % (chunkSize + 1),
                                        y: pos.y,
                                        z: pos.z
                                    },
                                    this.rengerGrid[containerIndex.x][
                                        containerIndex.y + 1
                                    ],
                                    chunkCenter
                                );
                            }

                            dimension.setBlock(
                                {
                                    x: absolutePos.x + 1,
                                    y: absolutePos.y,
                                    z: absolutePos.z
                                },
                                new Block(selectedBlockType)
                            );

                            break;
                        }

                        default: {
                            if (
                                keyState.lastKey === 5 &&
                                dimension.getBlock({
                                    x: absolutePos.x,
                                    y: absolutePos.y,
                                    z: absolutePos.z + 1
                                }) instanceof EmptyBlock &&
                                absolutePos.z + 1 < renderChunkHeight
                            ) {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",

                                    { x: pos.x, y: pos.y - 1, z: pos.z },
                                    container,
                                    chunkCenter
                                );
                                dimension.setBlock(
                                    {
                                        x: absolutePos.x,
                                        y: absolutePos.y,
                                        z: absolutePos.z + 1
                                    },
                                    new Block(selectedBlockType)
                                );
                            } else if (
                                keyState.lastKey === 6 &&
                                dimension.getBlock({
                                    x: absolutePos.x,
                                    y: absolutePos.y,
                                    z: absolutePos.z - 1
                                }) instanceof EmptyBlock &&
                                absolutePos.z - 1 > 0
                            ) {
                                this.renderBlock(
                                    colorMapper[selectedBlockType] ||
                                        "#00ff00",

                                    { x: pos.x, y: pos.y + 1, z: pos.z },
                                    container,
                                    chunkCenter
                                );
                                dimension.setBlock(
                                    {
                                        x: absolutePos.x,
                                        y: absolutePos.y,
                                        z: absolutePos.z - 1
                                    },
                                    new Block(selectedBlockType)
                                );
                            }
                        }
                    }
                } else {
                    const x: number =
                        sprite.containerCenter.x -
                        Math.ceil(renderChunkSize / 2) +
                        pos.x;
                    const y: number =
                        sprite.containerCenter.y -
                        Math.ceil(renderChunkSize / 2) +
                        pos.z;
                    const z: number = renderChunkHeight - pos.y - 1;
                    sprite.parent.removeChild(sprite);
                    dimension.setBlock({ x, y, z }, new EmptyBlock("air"));
                }
                // // console.log(shape);
                // // console.log(mousePos);
                // if (isPointInside(shape.right,mousePos)&&dimension.getBlock({
                //     x: absolutePos.x + 1,
                //     y: absolutePos.y,
                //     z: absolutePos.z
                // }) instanceof EmptyBlock) {
                //     this.renderBlock(
                //         "#00ff00",
                //         { x: pos.x + 1, y: pos.y, z: pos.z },
                //         container,
                //         chunkCenter
                //     );
                //     dimension.setBlock(
                //         {
                //             x: absolutePos.x + 1,
                //             y: absolutePos.y,
                //             z: absolutePos.z
                //         },
                //         new Block("grass")
                //     );
                //     console.log("right");
                //     console.log(shape);
                //     console.log(mousePos);
                // }

                // else if (
                //     isPointInside(shape.front,mousePos)&&dimension.getBlock({
                //         x: absolutePos.x,
                //         y: absolutePos.y+1,
                //         z: absolutePos.z
                //     })instanceof EmptyBlock
                // ) {
                //     this.renderBlock(
                //         "#00ff00",
                //         { x: pos.x, y: pos.y, z: pos.z + 1 },
                //         container,
                //         chunkCenter
                //     );
                //     dimension.setBlock(
                //         {
                //             x: absolutePos.x,
                //             y: absolutePos.y + 1,
                //             z: absolutePos.z
                //         },
                //         new Block("grass")
                //     );
                //     // if (absolutePos.z + 1 < renderChunkHeight) {
                //     //     this.renderBlock(
                //     //         "#00ff00",
                //     //         { x: pos.x, y: pos.y - 1, z: pos.z },
                //     //         container,
                //     //         chunkCenter
                //     //     );
                //     //     dimension.setBlock(
                //     //         {
                //     //             x: absolutePos.x,
                //     //             y: absolutePos.y,
                //     //             z: absolutePos.z + 1
                //     //         },
                //     //         new Block("grass")
                //     //     );
                //     // }
                //     console.log("front");
                //     console.log(shape);
                //     console.log(mousePos);
                // }

                // else if(
                //     isPointInside(shape.top,mousePos)&&(dimension.getBlock(
                //         {
                //             x: absolutePos.x,
                //             y: absolutePos.y,
                //             z: absolutePos.z+1
                //         }
                //     ) instanceof EmptyBlock ) && (absolutePos.z + 1 < renderChunkHeight)
                // ){
                //     this.renderBlock(
                //         "#00ff00",
                //         { x: pos.x, y: pos.y-1, z: pos.z },
                //         container,
                //         chunkCenter
                //     );
                //     dimension.setBlock(
                //         {
                //             x: absolutePos.x,
                //             y: absolutePos.y,
                //             z: absolutePos.z+1
                //         },
                //         new Block("grass")
                //     );
                //     console.log("top");
                //     console.log(shape);
                //     console.log(mousePos);
                // }
                // else {
                //     this.renderBlock(
                //         "#00ff00",
                //         { x: pos.x, y: pos.y, z: pos.z + 1 },
                //         container,
                //         chunkCenter
                //     );
                //     dimension.setBlock(
                //         {
                //             x: absolutePos.x,
                //             y: absolutePos.y + 1,
                //             z: absolutePos.z
                //         },
                //         new Block("grass")
                //     );
                // }
                // if (mousePos.x - globalPos.x > blockSize ) {
                //     dimension.setBlock({ x:absolutePos.x+1,y:absolutePos.y,z:absolutePos.z }, new Block("grass"));
                //     this.renderBlock("#000000", { x: pos.x+1, y: pos.y, z: pos.z }, container, chunkCenter);
                // }

                // else if (blockSize && mousePos.y - globalPos.y <= blockSize * Math.sin((5 / 12) * Math.PI ) ){
                //     if (absolutePos.z+1 < renderChunkHeight){
                //         dimension.setBlock({ x:absolutePos.x,y:absolutePos.y,z:absolutePos.z+1 }, new Block("grass"));
                //         this.renderBlock("#000000", { x: pos.x, y: pos.y-1, z: pos.z }, container, chunkCenter);
                //     }

                // }

                // else{
                //     dimension.setBlock({ x:absolutePos.x,y:absolutePos.y+1,z:absolutePos.z }, new Block("grass"));
                //     this.renderBlock("#000000", { x: pos.x, y: pos.y, z: pos.z+1 }, container, chunkCenter);
                // }
            }
        });
    }

    addNewBlockType(aiBlockData: { [key: string]: string }) {
        for (const key in aiBlockData) {
            if (!Object.hasOwn(aiBlockData, key)) continue;
            // console.log(key);
            const keyMody: string = extractFirstKey(key);
            // console.log(keyMody);
            const blockData: string = aiBlockData[key];
            // console.log(blockData);

            // console.log(typeof(blockData));
            if (!blockData.includes("#")) continue;
            colorMapper[keyMody] = blockData;
            inventory.addItem({
                type: keyMody,
                color: blockData
            });
            // keyMody : name of the block
            // blockData: 在那个if排除错误之后，是颜色，上面的if必须保留！必须保留！
        }

        console.log(colorMapper);
    }

    private renderRChunk(
        blockArray: Block[][][],
        stagePos: { x: number; y: number },
        chunkcenter: { x: number; y: number }
    ) {
        const container = new ExtendedContainer({ x: 0, y: 0 });
        traverse3DArray(blockArray, (value: Block, pos: BlockPos) => {
            if (value instanceof EmptyBlock) return;

            /**
             * The block on the right
             * ■ □ <- righter block
             * ↑ current block
             */
            const noRighterBlock =
                pos.x + 1 >= renderChunkSize ||
                blockArray[pos.x + 1][pos.y][pos.z] instanceof EmptyBlock;

            const noLeftBlock =
                pos.x - 1 < 0 ||
                blockArray[pos.x - 1][pos.y][pos.z] instanceof EmptyBlock;

            const noBackBlock =
                pos.y - 1 < 0 ||
                blockArray[pos.x][pos.y - 1][pos.z] instanceof EmptyBlock;

            /**
             * The block in front
             * ■ <- front block
             * ↑ current block (behind the front block)
             */
            const noFrontBlock =
                pos.y + 1 >= renderChunkSize ||
                blockArray[pos.x][pos.y + 1][pos.z] instanceof EmptyBlock;
            /**
             * The block above
             * □ <- upper block
             * ■ <- current block
             */
            const noUpperBlock =
                pos.z + 1 >= renderChunkHeight ||
                blockArray[pos.x][pos.y][pos.z + 1] instanceof EmptyBlock;

            // if (
            //     !noBackBlock &&
            //     !noRighterBlock &&
            //     !noFrontBlock &&
            //     !noLeftBlock &&
            //     !noUpperBlock
            // ) {
            //     return;
            // }

            // if (!noRighterBlock && !noFrontBlock && !noUpperBlock) {
            //     return;
            // }

            /**
             * 2 blocks above
             * □ <- upper and upper block
             * □
             * ■ <- current block
             */
            const noUpperAndUpperBlock =
                pos.z + 2 >= renderChunkHeight ||
                blockArray[pos.x][pos.y][pos.z + 2] instanceof EmptyBlock;
            /**
             * The block above the fronter block
             * □ <- upper and front block
             * ■ <- The front block, which is in front of the current block
             */
            const noUpperAndFrontBlock =
                pos.z + 1 >= renderChunkHeight ||
                pos.y + 1 >= renderChunkSize ||
                blockArray[pos.x][pos.y + 1][pos.z + 1] instanceof EmptyBlock;
            /**
             * The block above the righter block
             *   □ <- upper and righter block
             * ■ □ <- The righter block
             * ↑ current block
             */
            const noUpperAndRighterBlock =
                pos.z + 1 >= renderChunkHeight ||
                pos.x + 1 >= renderChunkSize ||
                blockArray[pos.x + 1][pos.y][pos.z + 1] instanceof EmptyBlock;

            // if (
            //     !noFrontBlock &&
            //     !noRighterBlock &&
            //     noUpperBlock &&
            //     !noUpperAndUpperBlock &&
            //     !noUpperAndFrontBlock &&
            //     !noUpperAndRighterBlock
            // )
            //     return;

            // if (upperBlock && righterBlock && frontBlock) return;
            // if (!(righterBlock || frontBlock)) return;
            const color =
                value.type in colorMapper
                    ? colorMapper[value.type]
                    : "#000000";
            pos = this.convertBlockPosToRenderBlockPos(pos);
            this.renderBlock(color, pos, container, chunkcenter);
        });

        container.x = stagePos.x;
        container.y = stagePos.y;

        return container;
    }

    private getBlockArray(center: CenterPos): Block[][][] {
        const array = dimension.getBlockArray(
            {
                x: center.x - Math.ceil(renderChunkSize / 2),
                y: center.y - Math.ceil(renderChunkSize / 2),
                z: 0
            },
            {
                x: center.x + Math.floor(renderChunkSize / 2),
                y: center.y + Math.floor(renderChunkSize / 2),
                z: renderChunkHeight - 1
            }
        );

        return array;
    }

    initStage(center?: CenterPos) {
        center ||= { x: 0, y: 0 };
        // for (let i = 0; i < yMaxChunkLength; i++) {
        //     this.addBottomRow();
        // }
        // const containers = generate2DArray({ x: 5, y: 1 }, (pos) => {

        for (let y = 0; y < yMaxChunkLength; y++) {
            const row: ExtendedContainer[] = [];
            for (let x = 0; x < xMaxChunkLength; x++) {
                const array = this.getBlockArray({
                    x: (x + center.x - offsetX) * chunkSize,
                    y: (y + center.y - offsetY) * chunkSize
                });

                // const array = dimension.getBlockArray(
                //     {

                //         x: x * 8,
                //         y: y * 8,
                //         z: 0
                //     },
                //     {
                //         x: x * 8 + 8,
                //         y: y * 8 + 8,
                //         z: 15
                //     }
                // );
                const container = this.renderRChunk(
                    array,
                    {
                        x:
                            getRenderFactor({ x, y: 0, z: y }).x *
                            (renderChunkSize + 1),
                        y:
                            getRenderFactor({ x, y: 0, z: y }).y *
                            (renderChunkSize + 1)
                    },
                    {
                        x: (x + center.x - offsetX) * chunkSize,
                        y: (y + center.y - offsetY) * chunkSize
                    }
                );
                this.app.stage.addChild(container);
                row.push(container);
            }

            this.rengerGrid.push(row);
        }

        // console.table(
        //     this.rengerGrid.map((row) =>
        //         row.map((chunk) => [chunk.x, chunk.y])
        //     )
        // );
    }

    // getCanvas(){
    //     const canvas:ICanvas = this.app.renderer.extract.canvas(this.app.stage);
    //     const dataURL:string = canvas.toDataURL();
    //     console.log(dataURL)
    //     // console.log('%c ', `font-size: 1px; padding: ${canvas.height / 2}px ${canvas.width / 2}px; background: url(${dataURL}) no-repeat; background-size: contain;`);
    // }

    private addTopRow() {
        const row: ExtendedContainer[] = [];
        // eslint-disable-next-line unicorn/no-array-for-each
        this.rengerGrid.pop()?.forEach((container) => {
            container.destroy();
        });

        const yStart = this.rengerGrid[0][0].y - renderChunkPixiHeight;
        this.currentYOffset--;
        this.center.y--;

        for (let x = 0; x < xMaxChunkLength; x++) {
            // const array = dimension.getBlockArray(
            //     {
            //         x: x * 8,
            //         y: 0,
            //         z: 0
            //     },
            //     {
            //         x: x * 8 + 8,
            //         y: 8,
            //         z: 15
            //     }
            // );
            const array = this.getBlockArray({
                x: (x + this.currentXOffset - offsetX) * chunkSize,
                y: (this.currentYOffset - offsetY) * chunkSize
            });

            // console.log("currentXOffset:", this.currentXOffset);
            const container = this.renderRChunk(
                array,
                {
                    x:
                        getRenderFactor({
                            x: x + this.currentXOffset,
                            // x: x - 1,
                            y: 0,
                            z: this.currentYOffset
                        }).x *
                        (renderChunkSize + 1),
                    y: yStart
                    // x: x * rendeerChunkWidth,
                    // y: yMaxChunkLength * rendeerChunkHeight
                },
                {
                    x: (x + this.currentXOffset - offsetX) * chunkSize,
                    y: (this.currentYOffset - offsetY) * chunkSize
                }
            );
            row.push(container);
        }

        this.rengerGrid.unshift(row);
        // this.app.stage.addChild(...row);
        for (const container of [...row].reverse()) {
            this.app.stage.addChildAt(container, 0);
        }

        // console.table(
        //     this.rengerGrid.map((row) =>
        //         row.map((chunk) => [chunk.x, chunk.y])
        //     )
        // );
    }

    private addRightColumn() {
        this.currentXOffset++;

        for (let y = 0; y < yMaxChunkLength; y++) {
            const xStart =
                this.rengerGrid[y][this.rengerGrid[y].length - 1].x +
                renderChunkPixiWidth;
            this.rengerGrid[y].shift()?.destroy();

            // const array = dimension.getBlockArray(
            //     {
            //         x: xMaxChunkLength * 8,
            //         y: y * 8,
            //         z: 0
            //     },
            //     {
            //         x: xMaxChunkLength * 8 + 8,
            //         y: y * 8 + 8,
            //         z: 15
            //     }
            // );
            const array = this.getBlockArray({
                x: (xMaxChunkLength - 1 + this.currentXOffset) * chunkSize,
                y: (y + this.currentYOffset - offsetY) * chunkSize
            });

            const container = this.renderRChunk(
                array,
                {
                    x: xStart,
                    y:
                        getRenderFactor({
                            x: xMaxChunkLength,
                            y: 0,
                            z: y + this.currentYOffset
                        }).y *
                        (renderChunkSize + 1)
                },
                {
                    x: (xMaxChunkLength - 1 + this.currentXOffset) * chunkSize,
                    y: (y + this.currentYOffset - offsetY) * chunkSize
                }
            );

            this.rengerGrid[y].push(container);
            this.app.stage.addChildAt(
                container,
                (y + 1) * xMaxChunkLength - 1
            );
        }
    }

    // 向最下方添加一排区块
    private addBottomRow() {
        const row: ExtendedContainer[] = [];
        // eslint-disable-next-line unicorn/no-array-for-each
        this.rengerGrid.shift()?.forEach((container) => {
            container.destroy();
        });
        // const topRow = this.rengerGrid.shift();
        // if (topRow) {
        //     for (const renderChunk of topRow) {
        //         renderChunk?.destroy();
        //     }
        // }
        const yStart =
            this.rengerGrid[this.rengerGrid.length - 1][0].y +
            renderChunkPixiHeight;
        this.currentYOffset++;

        for (let x = 0; x < xMaxChunkLength; x++) {
            // const array = dimension.getBlockArray(
            //     {
            //         x: x * 8,
            //         y: 0,
            //         z: 0
            //     },
            //     {
            //         x: x * 8 + 8,
            //         y: 8,
            //         z: 15
            //     }
            // );
            const array = this.getBlockArray({
                x: (x + this.currentXOffset - offsetX) * chunkSize,
                y:
                    (this.currentYOffset - offsetY + yMaxChunkLength) *
                    chunkSize
            });
            const container = this.renderRChunk(
                array,
                {
                    x:
                        getRenderFactor({
                            x: x + this.currentXOffset,
                            y: 0,
                            z: yMaxChunkLength - 1 + this.currentYOffset
                        }).x *
                        (renderChunkSize + 1),
                    y: yStart
                    // x: x * rendeerChunkWidth,
                    // y: yMaxChunkLength * rendeerChunkHeight
                },
                {
                    x: (x + this.currentXOffset - offsetX) * chunkSize,
                    y:
                        (this.currentYOffset - offsetY + yMaxChunkLength) *
                        chunkSize
                }
            );
            row.push(container);
        }

        this.rengerGrid.push(row);
        this.app.stage.addChild(...row);
    }

    private addLeftColumn() {
        this.currentXOffset--;

        // console.log(this.currentXOffset, this.currentYOffset);

        // console.log("Before:");
        // console.table(
        //     this.rengerGrid.map((row) =>
        //         row.map((chunk) => [chunk.x, chunk.y])
        //     )
        // );

        for (let y = 0; y < yMaxChunkLength; y++) {
            const xStart = this.rengerGrid[y][0].x - renderChunkPixiWidth;
            // console.log("xStart:", this.rengerGrid[y][0].x);
            this.rengerGrid[y].pop()?.destroy();

            // const array = dimension.getBlockArray(
            //     {
            //         x: -8,
            //         y: y * 8,
            //         z: 0
            //     },
            //     {
            //         x: 0,
            //         y: y * 8 + 8,
            //         z: 15
            //     }
            // );
            const array = this.getBlockArray({
                x: (0 + this.currentXOffset - offsetX) * chunkSize,
                y: (y + this.currentYOffset - offsetY) * chunkSize
            });
            const container = this.renderRChunk(
                array,
                {
                    x: xStart,
                    y:
                        getRenderFactor({
                            x: xMaxChunkLength,
                            // y: this.currentYOffset,
                            y: 0,
                            // z: this.currentXOffset + y
                            z: y + this.currentYOffset
                        }).y *
                        (renderChunkSize + 1)
                },
                {
                    x: (0 + this.currentXOffset - offsetX) * chunkSize,
                    y: (y + this.currentYOffset - offsetY) * chunkSize
                }
            );

            this.rengerGrid[y].unshift(container);
            this.app.stage.addChildAt(container, y * xMaxChunkLength);
        }

        // console.table(
        //     this.rengerGrid.map((row) =>
        //         row.map((chunk) => [chunk.x, chunk.y])
        //     )
        // );
    }

    // 是否将要超出屏幕
    private willOutOfScreen() {
        const result = [];
        const leftContainer = this.rengerGrid[0][0];
        // console.log("Left:", this.app.stage.x + leftContainer.x);
        if (this.app.stage.x + leftContainer.x > -renderChunkPixiWidth / 2)
            result.push("left");
        const rightContainer =
            this.rengerGrid[this.rengerGrid.length - 1][
                this.rengerGrid[0].length - 1
            ];
        // console.table(
        //     this.rengerGrid.map((row) =>
        //         row.map((chunk) => [chunk.x, chunk.y])
        //     )
        // );
        // Simplified from the following formula:
        // if (
        //     window.innerWidth -
        //         (this.app.stage.x + rightContainer.x) -
        //         renderChunkPixiWidth >
        //     -renderChunkPixiWidth / 2
        // )
        // console.log(rightContainer.x);
        // console.log(
        //     "Right:",
        //     window.innerWidth -
        //         (this.app.stage.x + rightContainer.x) -
        //         renderChunkPixiWidth
        // );
        if (
            this.app.stage.x + rightContainer.x <
            window.innerWidth - renderChunkPixiWidth / 2
        )
            result.push("right");
        const topContainer = this.rengerGrid[0][0];
        // if (topContainer.y > -renderChunkPixiHeight) result.push("top");
        if (this.app.stage.y + topContainer.y > -renderChunkPixiHeight / 2)
            result.push("top");
        const bottomContainer = this.rengerGrid[this.rengerGrid.length - 1][0];
        if (
            this.app.stage.y + bottomContainer.y <
            window.innerHeight - renderChunkPixiHeight / 2
        )
            result.push("bottom");
        // if (bottomContainer.y < window.innerHeight + renderChunkPixiHeight)
        //     result.push("bottom");
        // console.log(result);
        return result;
    }
}

const dimension = new Dimension({
    id: "overworld",
    generator: new Generator3D("seed")
});
const chunk = dimension.getChunkFromChunkPos({
    x: 0,
    y: 0
})!;

// const array = generate3DArray(
//     { x: worldSize, y: worldSize, z: worldHeight },
//     (pos) => {
//         return chunk.blocks[pos.x][pos.y][pos.z];
//     }
// );
// const array = dimension.getBlockArray(
//     {
//         x: 1,
//         y: 1,
//         z: 1
//     },
//     {
//         x: 8,
//         y: 8,
//         z: 15
//     }
// );

// const array2 = dimension.getBlockArray(
//     {
//         x: 9,
//         y: 1,
//         z: 1
//     },
//     {
//         x: 16,
//         y: 8,
//         z: 15
//     }
// );
// const render = await Render.getInstance();
// render.renderRChunk(array, {
//     x: getRenderFactor({ x: 0, y: 0, z: 0 }).x * renderChunkSize,
//     y: getRenderFactor({ x: 0, y: 0, z: 0 }).y * renderChunkSize
// });
// render.renderRChunk(array2, {
//     x: getRenderFactor({ x: 1, y: 0, z: 0 }).x * renderChunkSize,
//     y: getRenderFactor({ x: 1, y: 0, z: 0 }).y * renderChunkSize
// });

const render = await Render.getInstance();
render.initStage();

// 在全局范围内禁用右键菜单
document.addEventListener(
    "contextmenu",
    (event) => {
        event.preventDefault();
    },
    true
); // 使用 true 参数在捕获阶段监听事件，以提高处理优先级

export default render;
// render.addLeftColumn();
// render.addTopRow();
// render.addLeftColumn();
// render.addLeftColumn();
// render.addBottomRow();
// render.addBottomRow();
// render.addBottomRow();
// render.addLeftColumn();

// setTimeout(() => {
//     // render.addLeftColumn();
//     // render.addLeftColumn();
//     // render.addLeftColumn();
//     // render.addTopRow();
//     // render.addTopRow();
//     // render.addTopRow();
//     render.addBottomRow();
//     render.addBottomRow();
//     render.addBottomRow();
//     // render.addRightColumn();
//     // render.addRightColumn();
//     // render.addRightColumn();
// }, 5000);
// render.addBottomRow();

// render.app.ticker.add((time) => {
//     // render.app.stage.x += Math.sin(60) * time.deltaTime;
//     // render.app.stage.y += Math.cos(60) * time.deltaTime;
//     // render.app.stage.x += Math.round(Math.sin(60) * time.deltaTime);
//     // render.app.stage.y += Math.round(Math.cos(60) * time.deltaTime);
//     // render.app.stage.x += time.deltaTime;
//     render.app.stage.y += time.deltaTime;
//     // render.app.stage.y += time.deltaTime;
//     // render.app.stage.x -= time.deltaTime / 2;
//     // render.app.stage.y += time.deltaTime / 10;
//     // for (const row of render.rengerGrid) {
//     //     for (const chunk of row) {
//     //         if (!chunk) continue;
//     //         // chunk.y += time.deltaTime;
//     //         // chunk.x -= time.deltaTime;
//     //         // chunk.x -= time.deltaTime / 5;
//     //         chunk.y += time.deltaTime;
//     //         // if (chunk.y < -rendeerChunkHeight) {
//     //         //     chunk.y = yMaxChunkLength * rendeerChunkHeight;
//     //         // }
//     //     }
//     // }

//     // if (render.willOutOfScreen().includes("top")) {
//     //     render.addTopRow();
//     // }
//     console.log("------------------------------------------");
//     // while (render.willOutOfScreen().includes("top")) {
//     if (render.willOutOfScreen().includes("top")) {
//         console.log("Add top row");
//         render.addTopRow();
//     }

//     if (render.willOutOfScreen().includes("bottom")) {
//         render.addBottomRow();
//     }

//     // if (render.willOutOfScreen().includes("right")) {
//     //     render.addRightColumn();
//     // }
//     // while (render.willOutOfScreen().includes("right")) {
//     if (render.willOutOfScreen().includes("right")) {
//         console.log("Add right column");
//         render.addRightColumn();
//     }

//     // if (render.willOutOfScreen().includes("left")) {
//     //     render.addLeftColumn();
//     // }
//     // while (render.willOutOfScreen().includes("left")) {
//     if (render.willOutOfScreen().includes("left")) {
//         console.log("Add left column");
//         render.addLeftColumn();
//     }

//     // 触发断点，暂时终止程序执行
//     // debugger;

//     console.log(time.FPS);
// });

// 计算一个区块渲染时的宽高
// 注意这里chunk.width != width，因为区块之间渲染的时候有所重叠

// console.log(width, height);

// // const containers: Container[] = [];
// let centerPos = { x: 0, y: 0 };
// const maxRenderChunkLength = {
//     x: Math.ceil(render.app.screen.width / width) + 1,
//     y: Math.ceil(render.app.screen.height / height) + 1
// };

// const containers = generate2DArray({ x: 5, y: 1 }, (pos) => {
//     const offset = {
//         x: 0 - Math.floor(maxRenderChunkLength.x / 2),
//         y: 0 - Math.floor(maxRenderChunkLength.y / 2)
//     };

//     const array = dimension.getBlockArray(
//         {
//             x: pos.x * 8 + offset.x * 8,
//             y: pos.y * 8 + offset.y * 8,
//             z: 0
//         },
//         {
//             x: pos.x * 8 + 8 + offset.x * 8,
//             y: pos.y * 8 + 8 + offset.y * 8,
//             z: 15
//         }
//         // {
//         //     x: pos.x,
//         //     y: pos.y,
//         //     z: 0
//         // },
//         // {
//         //     x: pos.x,
//         //     y: pos.y,
//         //     z: 0
//         // }
//     );
//     const container = render.renderRChunk(array, {
//         x: getRenderFactor({ x: pos.x, y: 0, z: pos.y }).x * renderChunkSize,
//         y: getRenderFactor({ x: pos.x, y: 0, z: pos.y }).y * renderChunkSize
//     });
//     return container;
// });

// console.log(containers);

// let offset = 0;

// render.app.ticker.add((time) => {
//     console.time("render");
//     offset += time.deltaTime;
//     if (offset > width) offset -= width;

//     for (let [index, chunkList] of containers.entries()) {
//         for (const [indey, chunk] of chunkList.entries()) {
//             // console.error(chunk.x);
//             chunk.x += Number(time.deltaTime);
//             // 判断container是否在可视范围内，如果不，就删除自己
//             if (chunk.x + width < 0 || chunk.x > render.app.screen.width) {
//                 const array = dimension.getBlockArray(
//                     {
//                         x: indey * 8,
//                         y: 0,
//                         z: 0
//                     },
//                     {
//                         x: indey * 8 + 8,
//                         y: 8,
//                         z: 15
//                     }
//                     // {
//                     //     x: indey,
//                     //     y: 0,
//                     //     z: 0
//                     // },
//                     // {
//                     //     x: indey,
//                     //     y: 0,
//                     //     z: 0
//                     // }
//                 );

//                 const container = render.renderRChunk(array, {
//                     x: containers[0][0].x - width,
//                     y: chunkList[chunkList.length - 1].y
//                     // x:
//                     //     getRenderFactor({ x: 0, y: 0, z: index }).x *
//                     //         renderChunkSize -
//                     //     offset,
//                     // y:
//                     //     getRenderFactor({ x: 0, y: 0, z: index }).y *
//                     //     renderChunkSize
//                 });
//                 // chunkList.splice(indey, 1);
//                 containers.unshift([container]);
//                 containers.pop();
//                 chunk.destroy();
//                 // 从chunkList中删除当前的chunk
//                 // chunkList = [];
//                 // chunkList.push(container);
//             }
//         }
//     }

//     // console.timeEnd("render");
//     // console.log(render.app.ticker.FPS);
// });

// // for (let x = 0; x < 7; x++) {
// //     for (let y = 0; y < 7; y++) {
// //         const array = dimension.getBlockArray(
// //             {
// //                 x: x * 8,
// //                 y: y * 8,
// //                 z: 0
// //             },
// //             {
// //                 x: x * 8 + 8,
// //                 y: y * 8 + 8,
// //                 z: 15
// //             }
// //         );
// //         const container = render.renderRChunk(array, {
// //             x: getRenderFactor({ x, y: 0, z: y }).x * renderChunkSize,
// //             y: getRenderFactor({ x, y: 0, z: y }).y * renderChunkSize
// //         });
// //         containers.push(container);
// //     }
// // }

// // let maxX = 0; // 用于跟踪最右侧容器的x坐标

// // // // 初始化区块
// // // for (let x = 0; x < 7; x++) {
// // //     for (let y = 0; y < 7; y++) {
// // //         // 省略原有的区块生成逻辑...
// // //     }
// // // }

// // // 更新逻辑
// // render.app.ticker.add((time) => {
// //     console.time("render");
// //     let needNewChunk = false;

// //     for (const chunk of containers) {
// //         chunk.x += 1 * time.deltaTime;
// //         maxX = Math.max(maxX, chunk.x + chunk.width); // 更新最右侧容器的x坐标
// //     }

// //     // 检查是否需要新的区块来填补空隙
// //     if (maxX < render.app.screen.width) {
// //         needNewChunk = true;
// //     }

// //     // 如果需要新的区块
// //     if (needNewChunk) {
// //         // 计算新区块的位置
// //         const newX = Math.ceil(maxX / renderChunkSize) * renderChunkSize;
// //         for (let y = 0; y < 7; y++) {
// //             // 生成新的区块并添加到containers中
// //             // 注意：这里需要根据实际情况调整getBlockArray和getRenderFactor的参数
// //             const array = dimension.getBlockArray(
// //                 {
// //                     x: 8,
// //                     y: 8,
// //                     z: 0
// //                 },
// //                 {
// //                     x: 8 + 8,
// //                     y: 8 + 8,
// //                     z: 15
// //                 }
// //             );
// //             const container = render.renderRChunk(array, {
// //                 x: newX,
// //                 y:
// //                     getRenderFactor({ x: newX / renderChunkSize, y: 0, z: y })
// //                         .y * renderChunkSize
// //             });
// //             containers.push(container);
// //             maxX = Math.max(maxX, container.x + container.width); // 更新最右侧容器的x坐标
// //         }
// //     }

// //     console.timeEnd("render");
// //     console.log(render.app.ticker.FPS);
// // });
