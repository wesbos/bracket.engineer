import { exportTo3MF } from './export';
import { setupPreview } from "./preview";
import { createBracket, defaultParams } from "./psu-bracket";

interface BracketParams {
  width: number;
  depth: number;
  height: number;
  bracketThickness: number;
  ribbingCount: number;
  ribbingThickness: number;
  holeDiameter: number;
  earWidth: number;
  bottomType: 'none' | 'solid' | 'lip';
  lipSize?: number;
  color: string;
  holeOffset?: number;
}

// Initialize the preview
const canvas = document.getElementById("preview") as HTMLCanvasElement;
const updateBracket = setupPreview(canvas);

const controls = document.querySelector<HTMLFormElement>("#controls");
if (!controls) throw new Error("Could not find controls form element");

// Get all range inputs
const inputs = Array.from(controls.querySelectorAll<HTMLInputElement>("input"));
const rangeInputs = inputs.filter(input => input.type === 'range');
const valueInputs = inputs.filter(input => input.classList.contains('value-display'));
const bottomTypeSelect = document.getElementById('bottomType') as HTMLSelectElement;
const lipSizeContainer = document.getElementById('lipSizeContainer') as HTMLDivElement;
const lipSizeInput = document.getElementById('lipSize') as HTMLInputElement;
const widthInput = document.getElementById('width') as HTMLInputElement;
const heightInput = document.getElementById('height') as HTMLInputElement;

// Connect range inputs with their corresponding value display inputs
rangeInputs.forEach(rangeInput => {
  const valueInput = document.getElementById(`${rangeInput.id}Value`) as HTMLInputElement;
  if (valueInput) {
    // Update value display when range changes
    rangeInput.addEventListener('input', () => {
      valueInput.value = rangeInput.value;
    });
    
    // Update range when value display changes
    valueInput.addEventListener('input', () => {
      rangeInput.value = valueInput.value;
      // Trigger change event on the range input to update the model
      rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    // Also handle change event (when user finishes typing)
    valueInput.addEventListener('change', () => {
      rangeInput.value = valueInput.value;
      // Trigger change event on the range input to update the model
      rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
});

// Update the lip size max value based on current dimensions
function updateLipSizeMax() {
  const width = parseFloat(widthInput.value);
  const height = parseFloat(heightInput.value);
  
  // Allow the lip to cover almost the entire side, leaving a 2mm minimum opening
  const minOpeningSize = 2; // minimum opening size in mm
  const maxWidth = Math.max(width - minOpeningSize, 1);
  const maxHeight = Math.max(height - minOpeningSize, 1);
  
  // Set max to half the max width/height to allow for the lip on both sides
  const maxLipSize = Math.min(maxWidth / 2, maxHeight / 2);
  
  lipSizeInput.max = maxLipSize.toString();
  
  // Ensure current value doesn't exceed new max
  if (parseFloat(lipSizeInput.value) > maxLipSize) {
    lipSizeInput.value = maxLipSize.toString();
  }
  
  // Update the display
  const lipSizeDisplay = document.getElementById('lipSizeValue') as HTMLInputElement;
  if (lipSizeDisplay) {
    lipSizeDisplay.value = lipSizeInput.value;
  }
}

// Show/hide lip size control based on bottom type
function updateLipSizeVisibility() {
  if (bottomTypeSelect.value === 'lip') {
    lipSizeContainer.style.display = 'flex';
    updateLipSizeMax();
  } else {
    lipSizeContainer.style.display = 'none';
  }
}

function parseFormData(data: FormData) {
  const params: Record<string, any> = {};
  for(const [key, value] of data.entries()) {
    // Handle bottomType as a string
    if(key === 'bottomType') {
      params[key] = value.toString();
    } else {
      // First see if it's a checkbox
      if(value === "on") {
        params[key] = true;
      } else {
        const maybeNumber = parseFloat(value.toString());
        params[key] = isNaN(maybeNumber) ? value.toString() : maybeNumber;
      }
    }
  }
  return params as BracketParams;
}

function displayValues(params: BracketParams) {
  // Update all input fields based on params
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key as keyof BracketParams];
      if (value !== undefined) {
        const input = document.getElementById(key) as HTMLInputElement | null;
        if (input) {
          input.value = value.toString();
          
          // Also update the corresponding value display
          const valueDisplay = document.getElementById(`${key}Value`) as HTMLInputElement | null;
          if (valueDisplay) {
            valueDisplay.value = value.toString();
          }
        }
      }
    }
  }
  
  // Also pop the color on the root so we can use in css
  if (params.color) {
    document.documentElement.style.setProperty('--color', params.color);
  }
}

function updateUrl() {
  // Ensure controls exists
  if (!controls) return;
  
  const data = new FormData(controls);
  const urlParams = new URLSearchParams();
  
  // Convert FormData to URLSearchParams
  for (const [key, value] of data.entries()) {
    urlParams.append(key, value.toString());
  }
  
  history.pushState({}, '', `?${urlParams.toString()}`);
}

// On page load, check if there is a url param and parse it
function restoreState() {
  const url = new URLSearchParams(window.location.search);
  const urlParams = Object.fromEntries(url.entries());
  
  // Safe access helper function
  const safeParseFloat = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };
  
  const safeParseInt = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };
  
  const safeString = (value: string | undefined, defaultValue: string): string => {
    return value !== undefined ? value : defaultValue;
  };
  
  const params: BracketParams = {
    ...defaultParams,
    width: safeParseFloat(urlParams.width, defaultParams.width),
    depth: safeParseFloat(urlParams.depth, defaultParams.depth),
    height: safeParseFloat(urlParams.height, defaultParams.height),
    bracketThickness: safeParseFloat(urlParams.bracketThickness, defaultParams.bracketThickness),
    ribbingCount: safeParseInt(urlParams.ribbingCount, defaultParams.ribbingCount),
    ribbingThickness: safeParseFloat(urlParams.ribbingThickness, defaultParams.ribbingThickness),
    holeDiameter: safeParseFloat(urlParams.holeDiameter, defaultParams.holeDiameter),
    earWidth: safeParseFloat(urlParams.earWidth, defaultParams.earWidth),
    bottomType: (urlParams.bottomType as 'none' | 'solid' | 'lip' | undefined) || defaultParams.bottomType,
    color: safeString(urlParams.color, defaultParams.color || '#44ff00'),
    lipSize: safeParseFloat(urlParams.lipSize, defaultParams.lipSize || 10)
  };
  
  // Restore any params from the URL
  for(const [key, value] of Object.entries(params)) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    if(input) {
      input.value = value.toString();
    }
  }
  
  // Update the model with initial parameters
  updateBracket(params);
  displayValues(params);
  
  // trigger an input event to update the values
  const event = new Event('input', { bubbles: true });
  if (controls) {
    controls.dispatchEvent(event);
  }
}

// On page load, restore state
restoreState();
updateLipSizeVisibility();

// Add event listeners
function handleFormUpdate() {
  if (!controls) return;
  
  const params = parseFormData(new FormData(controls));
  updateBracket(params);
  displayValues(params);
  updateUrl();
  
  if (params.bottomType === 'lip') {
    updateLipSizeMax();
  }
}

controls.addEventListener("input", handleFormUpdate);
controls.addEventListener("change", handleFormUpdate);

// Add additional listeners for width and height changes
widthInput.addEventListener("input", updateLipSizeMax);
heightInput.addEventListener("input", updateLipSizeMax);
bottomTypeSelect.addEventListener("change", updateLipSizeVisibility);

const exportButton = document.getElementById("export-button") as HTMLButtonElement;
if (!exportButton) throw new Error("Could not find export button");
exportButton.addEventListener("click", async () => {
  const params = parseFormData(new FormData(controls));
  const model = createBracket(params);
  const dimensions = `${params.width}x${params.depth}x${params.height}`;
  const blob = await exportTo3MF(model, dimensions);
  const url = URL.createObjectURL(blob);
  // download the blob
  const a = document.createElement("a");
  a.href = url;
  a.download = `bracket-${dimensions}.3mf`;
  a.click();
});
