interface FlattenedJson {
    [key: string]: any;
}

function flattenJson(
    obj: any,
    parentKey: string = "",
    result: FlattenedJson = {}
): FlattenedJson {
    for (const key of Object.keys(obj)) {
        const newKey: string = parentKey ? `${parentKey}.${key}` : key;

        if (
            typeof obj[key] === "object" &&
            obj[key] !== null &&
            !Array.isArray(obj[key])
        ) {
            flattenJson(obj[key], newKey, result);
        } else {
            result[newKey] = obj[key];
        }
    }

    return result;
}

export { flattenJson };
