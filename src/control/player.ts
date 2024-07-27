import { KeyEvent } from "@/control/keyboard";
import { eventBus } from "@/data/event-bus";

type Direction = "up" | "down" | "left" | "right";
type PlayerMoveEventData = {
    directions: Set<Direction>;
};

/**
 * Handles the player movement events.
 */
class PlayerMovementHandler {
    private static instance: PlayerMovementHandler;

    private constructor() {
        eventBus.on("keychange", (event: unknown) => {
            this.handleKeyChange(event as KeyEvent);
        });
    }

    /**
     * Returns the singleton instance of the player movement handler.
     */
    static getInstance() {
        PlayerMovementHandler.instance ||= new PlayerMovementHandler();
        return PlayerMovementHandler.instance;
    }

    /**
     * Handles the keychange event.
     * @param event The keychange event.
     */
    handleKeyChange(event: KeyEvent) {
        const directions = new Set<Direction>();

        if (event.pressedKeys.has("w")) {
            directions.add("up");
        }

        if (event.pressedKeys.has("s")) {
            directions.add("down");
        }

        if (event.pressedKeys.has("a")) {
            directions.add("left");
        }

        if (event.pressedKeys.has("d")) {
            directions.add("right");
        }

        eventBus.emit("player:move", { directions });
    }
}

const playerMovementHandler = PlayerMovementHandler.getInstance();
export { playerMovementHandler, PlayerMoveEventData, Direction };
