import { exportTo3MF } from './export';
import { setupPreview } from "./preview";
import { createBracket, defaultParams } from "./psu-bracket";

// Bambu X1C textured plate defaults
const DEFAULT_PLATE_WIDTH = 256;
const DEFAULT_PLATE_DEPTH = 256;

interface BracketParams {
  width: number;
  depth: number;
  height: number;
  bracketThickness: number;
  ribbingCount: number;
  ribbingThickness: number;
  holeDiameter: number;
  earWidth: number;
  hasBottom: boolean;
  plateWidth: number;
  plateDepth: number;
}

// Initialize the preview
const canvas = document.getElementById("preview") as HTMLCanvasElement;
const updateBracket = setupPreview(canvas);

const controls = document.querySelector<HTMLFormElement>("#controls");

// Get all range inputs
const inputs = Array.from(controls?.querySelectorAll<HTMLInputElement>("input") ?? []).filter(input => !input.classList.contains('value-display'));
// todo - I have a tip somewhere on an easy way to split this into two arrays
const displayInputs = Array.from(controls?.querySelectorAll<HTMLInputElement>("input") ?? []).filter(input => input.classList.contains('value-display'));


function parseFormData(data: FormData) {
  const params: Record<string, any> = {};
  for(const [key, value] of data.entries()) {
    // First see if it's a checkbox
    if(value === "on") {
      params[key] = true;
    } else {
      const maybeNumber = parseFloat(value);
      params[key] = isNaN(maybeNumber) ? value : maybeNumber;
    }
  }
  return params as BracketParams;
}


function calculateTotalWidth(params: BracketParams) {
  return params.width + (params.bracketThickness * 2) + (params.earWidth * 2);
}

function calculateMaxInnerWidth(earWidth: number, bracketThickness: number, plateWidth: number) {
  return plateWidth - (earWidth * 2) - (bracketThickness * 2);
}

function displayValues(params: BracketParams) {
  const plateWidth = params.plateWidth || DEFAULT_PLATE_WIDTH;
  
  // Update the max width based on ear width and bracket thickness FIRST
  const widthInput = document.getElementById('width') as HTMLInputElement;
  const maxWidth = calculateMaxInnerWidth(params.earWidth, params.bracketThickness, plateWidth);
  if (widthInput) {
    widthInput.max = maxWidth.toString();
    // Clamp current value if it exceeds new max
    if (params.width > maxWidth) {
      params.width = maxWidth; // Update params so total width calculation is correct
      widthInput.value = maxWidth.toString();
      const widthValueInput = document.getElementById('widthValue') as HTMLInputElement;
      if (widthValueInput) {
        widthValueInput.value = maxWidth.toString();
      }
    }
  }
  
  for(const input of inputs) {
    // Find the value display - could be direct sibling or inside a wrapper
    let valueDisplay = input.nextElementSibling as HTMLElement;
    if (valueDisplay?.classList.contains('value-with-unit')) {
      valueDisplay = valueDisplay.querySelector('.value-display') as HTMLInputElement;
    }
    if(valueDisplay && valueDisplay.classList.contains('value-display')) {
      (valueDisplay as HTMLInputElement).value = `${input.value}`;
    }
  }
  
  // Calculate and display total width (after clamping)
  const totalWidth = calculateTotalWidth(params);
  const totalWidthDisplay = document.getElementById('totalWidth');
  if (totalWidthDisplay) {
    totalWidthDisplay.textContent = `${totalWidth}mm`;
    totalWidthDisplay.classList.toggle('over-limit', totalWidth > plateWidth);
  }
  
  // Update plate limit display
  const plateLimitDisplay = document.getElementById('plateLimitDisplay');
  if (plateLimitDisplay) {
    plateLimitDisplay.textContent = plateWidth.toString();
  }
  
  // Also pop the color on the root so we can use in css
  document.documentElement.style.setProperty('--color', params.color);
}

function handleInput(e: Event) {
  // If someone types into a valueDisplay, update the input
  if(e.target.classList.contains('value-display')) {
    const input = e.target.previousElementSibling as HTMLInputElement;
    input.value = e.target.value;
  }
  const data = new FormData(controls);
  const params = parseFormData(data);
  displayValues(params);
  updateBracket(params);
}

function updateUrl() {
  const data = new FormData(controls);
  const url = new URLSearchParams(data);
  history.pushState({}, '', `?${url.toString()}`);
}


controls.addEventListener("input", handleInput);
controls.addEventListener("change", updateUrl);

// Plate preset buttons
const presetButtons = document.querySelectorAll<HTMLButtonElement>('.plate-preset-btn');
const plateWidthInput = document.getElementById('plateWidth') as HTMLInputElement;
const plateDepthInput = document.getElementById('plateDepth') as HTMLInputElement;

function updateActivePreset() {
  const currentWidth = parseInt(plateWidthInput.value);
  const currentDepth = parseInt(plateDepthInput.value);
  
  presetButtons.forEach(btn => {
    const btnWidth = parseInt(btn.dataset.width || '0');
    const btnDepth = parseInt(btn.dataset.depth || '0');
    btn.classList.toggle('active', btnWidth === currentWidth && btnDepth === currentDepth);
  });
}

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const width = btn.dataset.width;
    const depth = btn.dataset.depth;
    if (width && depth) {
      plateWidthInput.value = width;
      plateDepthInput.value = depth;
      // Trigger input event to update the UI
      controls?.dispatchEvent(new Event('input', { bubbles: true }));
      controls?.dispatchEvent(new Event('change', { bubbles: true }));
      updateActivePreset();
    }
  });
});

// Update active preset when plate dimensions change manually
plateWidthInput.addEventListener('input', updateActivePreset);
plateDepthInput.addEventListener('input', updateActivePreset);

// Initialize active preset on page load
updateActivePreset();

// On page load, check if there is a url param and parse it
function restoreState() {

  const url = new URLSearchParams(window.location.search);
  const params = {
    defaultParams,
    ...parseFormData(url)
  }
  // Merge in any defaults
  // Restore any params from the URL
  for(const [key, value] of Object.entries(params)) {
    const input = document.getElementById(key) as HTMLInputElement;
    if(input) {
      input.value = value.toString();
    }
  }
  // trigger an input event to update the values
  const event = new Event('input', { bubbles: true });
  controls.dispatchEvent(event);
}


restoreState();


const exportButton = document.getElementById("export-button") as HTMLButtonElement;
exportButton.addEventListener("click", async  () => {
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
