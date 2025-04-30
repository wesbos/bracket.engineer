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
  bottomType: 'none' | 'solid' | 'lip';
  lipSize?: number; // Optional parameter for lip size
  color?: string;
  holeOffset?: number;
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

  // Create the cutout based on bottom type
  let cutOut;
  
  if (params.bottomType === 'none') {
    // For none, cut out the entire inside, including the bottom
    cutOut = Manifold.cube([params.width, params.height + BRACKET_THICKNESS, params.depth])
      .translate([BRACKET_THICKNESS, BRACKET_THICKNESS, 0]);
  } else if (params.bottomType === 'solid') {
    // For solid, leave the bottom intact
    cutOut = Manifold.cube([params.width, params.height + BRACKET_THICKNESS, params.depth - BRACKET_THICKNESS])
      .translate([BRACKET_THICKNESS, BRACKET_THICKNESS, BRACKET_THICKNESS]);
  } else { // bottomType === 'lip' or any other case
    // For lip, we'll do a more complex set of operations:
    // 1. First create the main cutout like for "none" - cutting everything out
    cutOut = Manifold.cube([params.width, params.height + BRACKET_THICKNESS, params.depth])
      .translate([BRACKET_THICKNESS, BRACKET_THICKNESS, 0]);
  }

  // Create the basic shell by removing the cutout
  let shell = Manifold.difference(mainBody, cutOut);

  // Now add the lip if needed
  if (params.bottomType === 'lip') {
    // Get lip size parameter or use default
    const lipSize = params.lipSize || 10;
    
    // Calculate the maximum possible lip size
    // Allow covering almost the entire dimension (leave at least 2mm opening)
    const minOpeningSize = 2; // minimum opening size in mm
    const maxWidth = Math.max(params.width - minOpeningSize, 1);
    const maxHeight = Math.max(params.height - minOpeningSize, 1);
    
    // Constrain the lip size to avoid exceeding bracket dimensions
    const constrainedLipSize = Math.min(lipSize, maxWidth / 2, maxHeight / 2);
    
    // Create the U-shaped lip as three separate pieces
    
    // 1. Bottom lip (spans the entire width)
    const bottomLip = Manifold.cube([
      params.width,                // Full width of bracket
      constrainedLipSize,          // Height is the lip size
      BRACKET_THICKNESS            // Same thickness as bracket
    ]).translate([
      BRACKET_THICKNESS,           // Align with bracket wall
      BRACKET_THICKNESS,           // Align with bracket floor
      0                            // At the bottom
    ]);
    
    // 2. Left side lip - extend to the full height from bottom lip to top of bracket
    const leftLip = Manifold.cube([
      constrainedLipSize,          // Width is the lip size
      params.height - constrainedLipSize + BRACKET_THICKNESS,  // Full height from bottom lip to top edge (including top thickness)
      BRACKET_THICKNESS            // Same thickness as bracket
    ]).translate([
      BRACKET_THICKNESS,           // Align with bracket wall
      BRACKET_THICKNESS + constrainedLipSize, // Start above the bottom lip
      0                            // At the bottom
    ]);
    
    // 3. Right side lip - extend to the full height from bottom lip to top of bracket
    const rightLip = Manifold.cube([
      constrainedLipSize,          // Width is the lip size
      params.height - constrainedLipSize + BRACKET_THICKNESS,  // Full height from bottom lip to top edge (including top thickness)
      BRACKET_THICKNESS            // Same thickness as bracket
    ]).translate([
      BRACKET_THICKNESS + params.width - constrainedLipSize, // Align with right edge minus lip width
      BRACKET_THICKNESS + constrainedLipSize, // Start above the bottom lip
      0                            // At the bottom
    ]);
    
    // Union the three lips together
    const lipFrame = Manifold.union([bottomLip, leftLip, rightLip]);
    
    // Add the lip frame to the shell
    shell = Manifold.union([shell, lipFrame]);
  }

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
  const hole = Manifold.cylinder(BRACKET_THICKNESS + RIBBING_HEIGHT, HOLE_DIAMETER, HOLE_DIAMETER, 100).rotate([0, 90, 90]).translate([params.earWidth / 2, -RIBBING_HEIGHT + BRACKET_THICKNESS, params.depth / 2]);
  let earItem = Manifold.union([ear, ...params.ribbingCount > 0 ? ribbings : []]);
  if (HOLE_DIAMETER) earItem = earItem.subtract(hole);
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
  if (itemCount <= 1) return [0];

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

  return positions;
}

export const defaultParams: BracketParams = {
  width: 35.5,
  depth: 16,
  height: 15,
  holeDiameter: 3.5,
  earWidth: 10,
  bracketThickness: 1,
  ribbingThickness: 1,
  ribbingCount: 0,
  bottomType: 'none',
  lipSize: 10, // Default lip size is 10mm
  color: "#44ff00"
};
