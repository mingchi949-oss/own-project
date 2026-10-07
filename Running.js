const message = document.querySelector("#tracker-message");
const timeDisplay = document.querySelector("#run-time");
const distanceDisplay = document.querySelector("#run-distance");
const caloriesDisplay = document.querySelector("#run-calories");
const paceDisplay = document.querySelector("#run-pace");
const weightInput = document.querySelector("#runner-weight");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const finishButton = document.querySelector("#finish-button");
const followButton = document.querySelector("#follow-button");
const recentRunsContainer = document.querySelector("#recent-runs");
const runStorageKey = "running-tracker-runs-v1";
const weightStorageKey = "running-tracker-weight-v1";
const maxAcceptedAccuracyMeters = 50;

let map;
let routeLine;
let positionMarker;
let startMarker;
let endMarker;
let watchId = null;
let runStartedAt = null;
let elapsedBeforeResume = 0;
let distanceMeters = 0;
let lastPosition = null;
let startPoint = null;
let endPoint = null;
let latestPosition = null;
let followLocation = true;
let timerId = null;
let running = false;
let paused = false;
let savedRuns = [];

function showMessage(text) {
  message.textContent = text;
  message.classList.remove("hidden");
}

function clearMessage() {
  message.textContent = "";
  message.classList.add("hidden");
}

function readSavedRuns() {
  try {
    const saved = localStorage.getItem(runStorageKey);
    if (saved === null) {
      return [];
    }
    const parsed = JSON.parse(saved);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (run) =>
          run &&
          typeof run.date === "string" &&
          typeof run.durationSeconds === "number" &&
          typeof run.distanceKm === "number" &&
          typeof run.calories === "number",
      )
    ) {
      throw new Error("Saved running history has an unexpected format.");
    }
    return parsed;
  } catch {
    showMessage(
      "Saved run history could not be read. New runs can still be tracked.",
    );
    return [];
  }
}

function loadWeight() {
  try {
    const savedWeight = Number(localStorage.getItem(weightStorageKey));
    if (
      Number.isFinite(savedWeight) &&
      savedWeight >= 1 &&
      savedWeight <= 500
    ) {
      weightInput.value = String(savedWeight);
    }
  } catch {
    showMessage(
      "Browser storage is unavailable. Your weight and runs may not be saved.",
    );
  }
}

function saveWeight() {
  const weight = Number(weightInput.value);
  if (!Number.isFinite(weight) || weight < 1 || weight > 500) {
    showMessage("Enter a weight between 1 and 500 kg to estimate calories.");
    return false;
  }
  try {
    localStorage.setItem(weightStorageKey, String(weight));
  } catch {
    showMessage("Your weight could not be saved in this browser.");
  }
  return true;
}

function saveRuns() {
  try {
    localStorage.setItem(runStorageKey, JSON.stringify(savedRuns));
  } catch {
    showMessage(
      "This run was tracked, but could not be saved in browser storage.",
    );
  }
}

function formatDuration(seconds) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatPace(durationSeconds, distanceKm) {
  if (distanceKm <= 0) {
    return "--:--";
  }
  const secondsPerKm = Math.floor(durationSeconds / distanceKm);
  return `${String(Math.floor(secondsPerKm / 60)).padStart(2, "0")}:${String(secondsPerKm % 60).padStart(2, "0")}`;
}

function estimateCalories(durationSeconds) {
  const weightKg = Number(weightInput.value);
  if (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) {
    return 0;
  }
  const runningMet = 8.3;
  return Math.round(
    ((runningMet * 3.5 * weightKg) / 200) * (durationSeconds / 60),
  );
}

function elapsedSeconds() {
  if (!running || runStartedAt === null) {
    return elapsedBeforeResume;
  }
  return elapsedBeforeResume + (Date.now() - runStartedAt) / 1000;
}

function updateStats() {
  const duration = elapsedSeconds();
  const distanceKm = distanceMeters / 1000;
  timeDisplay.textContent = formatDuration(duration);
  distanceDisplay.textContent = distanceKm.toFixed(2);
  caloriesDisplay.textContent = String(estimateCalories(duration));
  paceDisplay.textContent = formatPace(duration, distanceKm);
}

function haversineMeters(first, second) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(second.lat - first.lat);
  const longitudeDifference = toRadians(second.lng - first.lng);
  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function onPosition(position) {
  if (!running || paused) {
    return;
  }
  const point = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };

  latestPosition = point;
  followButton.disabled = false;
  followButton.textContent = followLocation ? "Following" : "🔍";
  positionMarker.setLatLng([point.lat, point.lng]);
  positionMarker.setStyle({ opacity: 1, fillOpacity: 1 });
  if (followLocation) {
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), 16), {
      animate: false,
    });
  }

  if (position.coords.accuracy > maxAcceptedAccuracyMeters) {
    showMessage(
      `Following your location, but GPS accuracy is about ${Math.round(position.coords.accuracy)} m. The route and distance will update when accuracy improves.`,
    );
    return;
  }
  clearMessage();

  if (!startPoint) {
    startPoint = point;
    startMarker.setLatLng([point.lat, point.lng]);
    startMarker.setStyle({ opacity: 1, fillOpacity: 1 });
    startMarker.bindTooltip("Start", {
      permanent: true,
      direction: "top",
      offset: [0, -8],
    });
  }

  if (lastPosition) {
    const movedMeters = haversineMeters(lastPosition, point);
    const elapsedBetweenFixes =
      (position.timestamp - lastPosition.timestamp) / 1000;
    const speedMetersPerSecond =
      elapsedBetweenFixes > 0 ? movedMeters / elapsedBetweenFixes : Infinity;
    if (movedMeters > 0 && speedMetersPerSecond <= 12) {
      distanceMeters += movedMeters;
    }
  }

  lastPosition = { ...point, timestamp: position.timestamp };
  endPoint = point;
  routeLine.addLatLng([point.lat, point.lng]);
  endMarker.setLatLng([point.lat, point.lng]);
  updateStats();
}

function onLocationError(error) {
  const explanations = {
    1: "Location permission was denied. Allow location access in your browser settings to track a run.",
    2: "Your current location could not be found. Check that location services are enabled and try again.",
    3: "Getting your location timed out. Try again somewhere with a clearer GPS signal.",
  };
  showMessage(explanations[error.code] || `GPS error: ${error.message}`);
  if (running && distanceMeters === 0 && !lastPosition) {
    stopTracking();
    running = false;
    paused = false;
    runStartedAt = null;
    elapsedBeforeResume = 0;
    startButton.disabled = false;
    pauseButton.disabled = true;
    finishButton.disabled = true;
    updateStats();
  }
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTracking() {
  clearMessage();
  if (!navigator.geolocation) {
    showMessage("This browser does not support GPS location tracking.");
    return;
  }
  if (!window.isSecureContext) {
    showMessage(
      "GPS requires a secure page. Open this page over HTTPS or through localhost, not as a file.",
    );
    return;
  }
  if (!saveWeight()) {
    return;
  }

  running = true;
  paused = false;
  runStartedAt = Date.now();
  elapsedBeforeResume = 0;
  distanceMeters = 0;
  lastPosition = null;
  startPoint = null;
  endPoint = null;
  latestPosition = null;
  followLocation = true;
  followButton.textContent = "🔍";
  followButton.disabled = true;
  routeLine.setLatLngs([]);
  startMarker.closeTooltip();
  endMarker.closeTooltip();
  startMarker.unbindTooltip();
  endMarker.unbindTooltip();
  startMarker.setStyle({ opacity: 0, fillOpacity: 0 });
  endMarker.setStyle({ opacity: 0, fillOpacity: 0 });
  positionMarker.setStyle({ opacity: 0, fillOpacity: 0 });
  updateStats();
  startButton.disabled = true;
  pauseButton.disabled = false;
  finishButton.disabled = false;
  pauseButton.textContent = "Pause";
  timerId = setInterval(updateStats, 1000);
  showMessage("Waiting for GPS location. Keep this page open while you run.");
  watchId = navigator.geolocation.watchPosition(onPosition, onLocationError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 20000,
  });
}

function togglePause() {
  if (!running && !paused) {
    return;
  }
  if (paused) {
    paused = false;
    running = true;
    runStartedAt = Date.now();
    lastPosition = null;
    clearMessage();
    pauseButton.textContent = "Pause";
    timerId = setInterval(updateStats, 1000);
    watchId = navigator.geolocation.watchPosition(onPosition, onLocationError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    });
    updateStats();
    return;
  }

  elapsedBeforeResume = elapsedSeconds();
  running = false;
  paused = true;
  stopTracking();
  lastPosition = null;
  pauseButton.textContent = "Resume";
  updateStats();
}

function haversineCenter() {
  map.setView([20, 0], 2);
}

function renderSavedRuns() {
  recentRunsContainer.replaceChildren();
  if (savedRuns.length === 0) {
    const empty = document.createElement("p");
    empty.className =
      "rounded-xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-500";
    empty.textContent = "Finished runs will appear here on this device.";
    recentRunsContainer.append(empty);
    return;
  }

  for (const run of [...savedRuns].reverse().slice(0, 10)) {
    const entry = document.createElement("article");
    entry.className =
      "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3";
    const date = document.createElement("p");
    date.className = "text-sm font-medium";
    date.textContent = new Date(run.date).toLocaleString();
    const stats = document.createElement("p");
    stats.className = "text-sm text-slate-400";
    stats.textContent = `${run.distanceKm.toFixed(2)} km · ${formatDuration(run.durationSeconds)} · ${run.calories} kcal`;
    entry.append(date, stats);
    recentRunsContainer.append(entry);
  }
}

function finishRun() {
  if (!running && !paused) {
    return;
  }
  const durationSeconds = elapsedSeconds();
  const distanceKm = distanceMeters / 1000;
  if (durationSeconds > 0 || distanceKm > 0) {
    savedRuns.push({
      date: new Date().toISOString(),
      durationSeconds,
      distanceKm,
      calories: estimateCalories(durationSeconds),
    });
    saveRuns();
    renderSavedRuns();
  }

  stopTracking();
  running = false;
  paused = false;
  runStartedAt = null;
  elapsedBeforeResume = durationSeconds;
  lastPosition = null;
  if (endPoint) {
    endMarker.setLatLng([endPoint.lat, endPoint.lng]);
    endMarker.setStyle({ opacity: 1, fillOpacity: 1 });
    endMarker.bindTooltip("Finish", {
      permanent: true,
      direction: "top",
      offset: [0, -8],
    });
  }
  const routeBounds = routeLine.getBounds();
  if (routeBounds.isValid()) {
    map.fitBounds(routeBounds, { padding: [40, 40], maxZoom: 16 });
  }
  startButton.disabled = false;
  pauseButton.disabled = true;
  finishButton.disabled = true;
  pauseButton.textContent = "Pause";
  updateStats();
  showMessage("Run finished and saved on this device.");
}

function initializeMap() {
  map = L.map("run-map").setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  routeLine = L.polyline([], { color: "#22d3ee", weight: 5 }).addTo(map);
  positionMarker = L.circleMarker([20, 0], {
    radius: 8,
    color: "#083344",
    fillColor: "#22d3ee",
    fillOpacity: 0,
    opacity: 0,
    weight: 3,
  }).addTo(map);
  startMarker = L.circleMarker([20, 0], {
    radius: 9,
    color: "#052e16",
    fillColor: "#4ade80",
    fillOpacity: 0,
    opacity: 0,
    weight: 3,
  }).addTo(map);
  endMarker = L.circleMarker([20, 0], {
    radius: 9,
    color: "#4c0519",
    fillColor: "#fb7185",
    fillOpacity: 0,
    opacity: 0,
    weight: 3,
  }).addTo(map);
  map.on("dragstart zoomstart", () => {
    if (running && followLocation) {
      followLocation = false;
      followButton.textContent = "🔍";
    }
  });
}

startButton.addEventListener("click", startTracking);
pauseButton.addEventListener("click", togglePause);
finishButton.addEventListener("click", finishRun);
followButton.addEventListener("click", () => {
  if (!latestPosition) {
    showMessage(
      "Waiting for your GPS location. Allow location access and start a run first.",
    );
    return;
  }
  followLocation = true;
  followButton.textContent = "🔍";
  map.setView(
    [latestPosition.lat, latestPosition.lng],
    Math.max(map.getZoom(), 16),
  );
  clearMessage();
});
weightInput.addEventListener("change", () => {
  if (saveWeight()) {
    clearMessage();
    updateStats();
  }
});

initializeMap();
savedRuns = readSavedRuns();
loadWeight();
renderSavedRuns();
updateStats();
