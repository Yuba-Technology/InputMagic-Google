type Point = { x: number; y: number };
type Points = Array<Point>;

/**
 * Calculates the cross product of vectors AP and BP.
 * @param {Point} A - Coordinates of point A
 * @param {Point} B - Coordinates of point B
 * @param {Point} P - Coordinates of point P
 * @returns {number} - The cross product of vectors AP and BP
 */
function crossProduct(A: Point, B: Point, P: Point): number {
    return (P.x - A.x) * (P.y - B.y) - (P.y - A.y) * (P.x - B.x);
}

/**
 * Calculates the dot product of vectors PA and PB.
 * @param {Point} A - Coordinates of point A
 * @param {Point} B - Coordinates of point B
 * @param {Point} P - Coordinates of point P
 * @returns {number} - The dot product of vectors PA and PB
 */
function dotProduct(A: Point, B: Point, P: Point): number {
    return (A.x - P.x) * (B.x - P.x) + (A.y - P.y) * (B.y - P.y);
}

/**
 * Checks if point P is inside the polygon defined by Shape.
 * @param {Points} Shape - Array of points defining the polygon
 * @param {Point} P - Coordinates of the point to check
 * @returns {boolean} - Whether the point P is inside the polygon
 */
function isPointInside(Shape: Points, P: Point): boolean {
    const length: number = Shape.length;
    let multi: number = 1; // this is  for sign caculation
    for (let i = 0; i < length; i++) {
        const crossResult: number = crossProduct(
            Shape[i],
            Shape[(i + 1) % length],
            P
        );
        if (
            !crossResult &&
            dotProduct(Shape[i], Shape[(i + 1) % length], P) > 0
        ) {
            // this indicates co-linear, and we can find out result very fast
            return false;
        }

        if (
            !crossResult &&
            dotProduct(Shape[i], Shape[(i + 1) % length], P) < 0
        ) {
            return true;
        }

        multi *= crossResult;
    }

    return multi > 0;
}

export { isPointInside, Point, Points };

// const parallelograms: Array<{ shape: Points, point: Point, expected: boolean }> = [
//     {
//         shape: [
//             { x: 0, y: 0 },
//             { x: 4, y: 0 },
//             { x: 5, y: 3 },
//             { x: 1, y: 3 }
//         ],
//         point: { x: 2, y: 1 }, // Inside
//         expected: true
//     },
//     {
//         shape: [
//             { x: 0, y: 0 },
//             { x: 4, y: 0 },
//             { x: 5, y: 3 },
//             { x: 1, y: 3 }
//         ],
//         point: { x: 5, y: 1 }, // Outside
//         expected: false
//     },
//     {
//         shape: [
//             { x: 1, y: 1 },
//             { x: 5, y: 1 },
//             { x: 6, y: 4 },
//             { x: 2, y: 4 }
//         ],
//         point: { x: 3, y: 2 }, // Inside
//         expected: true
//     },
//     {
//         shape: [
//             { x: 1, y: 1 },
//             { x: 5, y: 1 },
//             { x: 6, y: 4 },
//             { x: 2, y: 4 }
//         ],
//         point: { x: 7, y: 3 }, // Outside
//         expected: false
//     }
// ];

// parallelograms.forEach(({ shape, point, expected }, index) => {
//     const isInside = isPointInside(shape, point);
//     const result = isInside === expected ? 'PASSED' : 'FAILED';
//     console.log(`Parallelogram ${index + 1}: Point (${point.x}, ${point.y}) is ${isInside ? 'inside' : 'outside'} - Expected: ${expected} - Test ${result}`);
// });
