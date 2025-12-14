import Module from 'manifold-3d';

// Load Manifold WASM library
const wasm = await Module();
wasm.setup();
const { Manifold, CrossSection } = wasm;

type BracketParams = {
  width: number;
  depth: number;
  height: number;
  holeDiameter: number;
  earWidth: number;
  bracketThickness: number;
  ribbingThickness: number;
  ribbingCount: number;
  hasBottom: boolean;
  holeCount: number;
}


function roundedCube(size: [number, number, number], radius: number = 20, circularSegments: number = 90) {
  const [width, height, depth] = size;
  // the radius cannot be greater than half the smallest side
  const maxRadius = Math.min(radius, width / 2, depth / 2);
  const post = Manifold.cylinder(height, maxRadius, maxRadius, circularSegments).translate([-maxRadius, -maxRadius, 0]).rotate([0, 90, 90]);

  const walkx = width - maxRadius * 2;
  const walkz = depth - maxRadius * 2;

  const roundedCube = Manifold.union([
    post,
    post.translate([walkx, 0, 0]),
    post.translate([walkx, 0, walkz]),
    post.translate([0, 0, walkz]),
    // Manifold.cube([width, height, depth]),
  ]).hull();
  return roundedCube;
}

// Function to create the bracket with given parameters
export function createBracket(params: BracketParams) {
  // Create the main bracket body
  const BRACKET_THICKNESS = params.bracketThickness;
  const HEIGHT_WITH_THICKNESS = params.height + BRACKET_THICKNESS;
  const WIDTH_WITH_THICKNESS = params.width + BRACKET_THICKNESS * 2;
  const HOLE_DIAMETER = Math.min(params.holeDiameter, (params.earWidth / 2) - 1, (params.depth / 2) - 1);

  const COMMAND_STRIP = {
    LENGTH: 46,
    WIDTH: 15.8,
    THICKNESS: 1.6,
  }

  const mainBody = Manifold.cube(
    [params.width + BRACKET_THICKNESS * 2,
    params.height + BRACKET_THICKNESS * 2,
    params.depth]
  );



  const cutOut = Manifold.cube([params.width, params.height + BRACKET_THICKNESS, params.depth]).translate([0, BRACKET_THICKNESS, params.hasBottom ? -BRACKET_THICKNESS : 0]).translate([BRACKET_THICKNESS, 0, 0])

  const shell = Manifold.difference(mainBody, cutOut);

  // Create mounting ears
  const ear = Manifold.cube([params.earWidth, BRACKET_THICKNESS, params.depth]);

  // Create the command strip cutout
  const commandStripCutout = Manifold.cube([COMMAND_STRIP.WIDTH, COMMAND_STRIP.THICKNESS, COMMAND_STRIP.LENGTH]);

  const ribbingSpacing = calculateSpacing({
    availableWidth: params.depth,
    itemWidth: params.ribbingThickness,
    itemCount: params.ribbingCount,
  });

  // Create contour for the ribbing
  const RIBBING_WIDTH = params.earWidth * 0.5; // 80% of the ear width
  const RIBBING_HEIGHT = HEIGHT_WITH_THICKNESS * 0.8; // 80% of the height
  const contour = new CrossSection([
    [0, RIBBING_HEIGHT],
    [RIBBING_WIDTH, RIBBING_HEIGHT],
    [RIBBING_WIDTH, 0],
  ], 'Negative');
  const singleRib = contour.extrude(params.ribbingThickness);
  const ribbings = ribbingSpacing.map(spacing => singleRib.translate([RIBBING_WIDTH, -RIBBING_HEIGHT, spacing]));

  // Put the ears together
  const singleHole = Manifold.cylinder(BRACKET_THICKNESS + RIBBING_HEIGHT, HOLE_DIAMETER, HOLE_DIAMETER, 100).rotate([0, 90, 90])
  const key = roundedCube([HOLE_DIAMETER, BRACKET_THICKNESS + RIBBING_HEIGHT, HOLE_DIAMETER * 2], 10).translate([-HOLE_DIAMETER / 2, 0, 0]);

  const hole = Manifold.union([singleHole, ...params.keyHole ? [key] : []]).translate([params.earWidth / 2, -RIBBING_HEIGHT + BRACKET_THICKNESS, params.depth / 2]);


  let earItem = Manifold.union([ear, ...params.ribbingCount > 0 ? ribbings : []]);

  // Create multiple holes if needed
  if (HOLE_DIAMETER) {
    const holes = [];
    if (params.holeCount === 1) {
      // Center single hole
      holes.push(hole);
    } else {
      const size = hole.boundingBox();
      const [x, y, z] = size.max;
      // Calculate spacing for multiple holes
      const edgePadding = Math.max(HOLE_DIAMETER * 3, 10); // Add extra padding at edges
      const totalSpace = params.depth - (edgePadding * 2); // Leave space at edges
      const spacing = totalSpace / (params.holeCount - 1);

      for (let i = 0; i < params.holeCount; i++) {
        const zPos = edgePadding + (i * spacing);
        holes.push(hole.translate([0, 0, zPos - params.depth / 2]));
      }
    }
    earItem = earItem.subtract(Manifold.union(holes));
  }

  const leftEar = earItem.translate([-params.earWidth, HEIGHT_WITH_THICKNESS, 0]);
  const rightEar = leftEar.mirror([1, 0, 0]).translate([params.width + params.bracketThickness * 2, 0, 0]);
  const bracket = Manifold.union([shell, leftEar, rightEar]);
  // center the bracket on the origin
  const size = bracket.boundingBox();
  const [x, y, z] = size.max;
  return bracket.translate([-x / 2, 0, -z / 2]);
}


function calculateSpacing({
  availableWidth,
  itemWidth,
  itemCount,
}: {
  availableWidth: number;
  itemWidth: number;
  itemCount: number;
}) {
  if (itemCount === 1) return [availableWidth / 2]; // Center single hole

  // Calculate the total space needed for all items
  const totalItemWidth = itemWidth * itemCount;

  // Calculate the total space between items, accounting for insets
  const totalSpacing = availableWidth - totalItemWidth - (itemWidth * 2); // Subtract space for insets

  // Calculate the space between each item
  const spacingBetweenItems = totalSpacing / (itemCount - 1);

  // Calculate the starting position of each item
  const positions = [];
  for (let i = 0; i < itemCount; i++) {
    // First item starts at itemWidth (inset by one thickness)
    // Each subsequent item is spaced by (itemWidth + spacingBetweenItems)
    const startPosition = itemWidth + i * (itemWidth + spacingBetweenItems);
    positions.push(startPosition);
  }

  // Ensure the last hole is one hole diameter away from the edge
  const lastPosition = positions[positions.length - 1];
  if (lastPosition + itemWidth > availableWidth - itemWidth) {
    const adjustment = (lastPosition + itemWidth) - (availableWidth - itemWidth);
    positions.forEach((pos, i) => {
      positions[i] = pos - (adjustment * i / (positions.length - 1));
    });
  }

  return positions;
}

export const defaultParams: BracketParams = {
  width: 200,
  depth: 25,
  height: 16,
  holeDiameter: 2,
  earWidth: 10,
  bracketThickness: 3,
  ribbingThickness: 2,
  ribbingCount: 3,
  hasBottom: false,
  holeCount: 1,
  keyHole: false,
};
