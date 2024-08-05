import { eventBus } from "@/data/event-bus";

type Item = {
    type: string;
    color: string;
};

const ItemFactory = {
    create(_type: string, color: string): HTMLElement {
        // Draw an image of the item using the given color
        const wrapper = document.createElement("li");
        const element = document.createElement("div");
        element.style.width = "calc(100% - 20px)";
        element.style.height = "calc(100% - 20px)";
        element.style.borderRadius = "5px";
        element.style.margin = "auto";
        element.style.backgroundColor = color;
        wrapper.append(element);
        wrapper.style.display = "flex";
        return wrapper;
    }
};

class Inventory {
    static instance: Inventory;
    static LENGTH = 9; // 9 slots in the inventory
    element: HTMLElement = document.getElementById("inventory")!;
    items: Item[] = [];

    static getInstance() {
        Inventory.instance ||= new Inventory();
        return Inventory.instance;
    }

    constructor() {
        // 监听鼠标滚轮事件
        document.addEventListener("wheel", (e) => {
            // 往下滚动则选中下一个物品
            const activeIndex = Array.from(this.element.children).findIndex(
                (item) => item.classList.contains("active")
            );
            // Next item
            if (e.deltaY > 0) {
                if (
                    activeIndex < Inventory.LENGTH - 1 &&
                    activeIndex < this.items.length - 1
                ) {
                    this.handleSelect(activeIndex + 1);
                    return;
                }

                this.handleSelect(0);
            }
            // Previous item
            else {
                if (activeIndex > 0) {
                    this.handleSelect(activeIndex - 1);
                    return;
                }

                this.handleSelect(
                    Math.min(Inventory.LENGTH - 1, this.items.length - 1)
                );
            }
        });
    }

    setItem(index: number, item: Item) {
        this.items[index] = item;

        this.draw();
    }

    addItem(item: Item) {
        this.items.unshift(item);
        this.draw();
    }

    private handleSelect(index: number) {
        for (const item of this.element.children) {
            item.classList.remove("active");
        }

        this.element.children[index].classList.add("active");
        eventBus.emit("inventory:select", {
            type: this.items[index].type,
            color: this.items[index].color
        });
    }

    private draw() {
        this.element.innerHTML = "";
        for (let i = 0; i < Inventory.LENGTH; i++) {
            const item = this.items[i];
            if (!item) continue;

            const element = ItemFactory.create(item.type, item.color);
            element.style.width = "50px";
            element.style.height = "50px";
            element.addEventListener("click", () => {
                this.handleSelect(i);
            });
            this.element.append(element);
        }

        const backpack = document.getElementById("backpack-list")!;
        backpack.innerHTML = "";
        for (const item of this.items) {
            const element = ItemFactory.create(item.type, item.color);
            element.style.width = "50px";
            element.style.height = "50px";
            backpack.append(element);
        }
    }
}

const inventory = Inventory.getInstance();

export { inventory, Item };
