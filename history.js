const runStorageKey = "running-tracker-runs-v1";
const completionHistoryKey = "weekly-life-gym-completions-v1";
const historyMessage = document.querySelector("#history-message");
const runsList = document.querySelector("#runs-list");
const scheduleHistoryList = document.querySelector("#schedule-history-list");

function showMessage(text) {
    historyMessage.textContent = text;
    historyMessage.classList.remove("hidden");
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
        return "--:-- /km";
    }
    const secondsPerKm = Math.floor(durationSeconds / distanceKm);
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = secondsPerKm % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} /km`;
}

function readRuns() {
    let saved;
    try {
        saved = localStorage.getItem(runStorageKey);
    } catch {
        showMessage("Browser storage is unavailable, so your run history cannot be loaded.");
        return [];
    }

    if (saved === null) {
        return [];
    }

    try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every((run) =>
            run &&
            typeof run.date === "string" &&
            Number.isFinite(Date.parse(run.date)) &&
            Number.isFinite(run.durationSeconds) &&
            run.durationSeconds >= 0 &&
            Number.isFinite(run.distanceKm) &&
            run.distanceKm >= 0 &&
            Number.isFinite(run.calories) &&
            run.calories >= 0
        )) {
            throw new Error("Saved run history has an unexpected format.");
        }
        return parsed;
    } catch {
        showMessage("Saved run history could not be read because its data is invalid.");
        return [];
    }
}

function readScheduleCompletions() {
    let saved;
    try {
        saved = localStorage.getItem(completionHistoryKey);
    } catch {
        showMessage("Browser storage is unavailable, so your weekly schedule history cannot be loaded.");
        return [];
    }

    if (saved === null) {
        return [];
    }

    try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every((completion) =>
            completion &&
            typeof completion.id === "string" &&
            typeof completion.title === "string" &&
            typeof completion.day === "string" &&
            typeof completion.time === "string" &&
            (completion.type === "life" || completion.type === "gym") &&
            typeof completion.completedAt === "string" &&
            Number.isFinite(Date.parse(completion.completedAt))
        )) {
            throw new Error("Saved schedule history has an unexpected format.");
        }
        return parsed;
    } catch {
        showMessage("Saved weekly schedule history could not be read because its data is invalid.");
        return [];
    }
}

function formatActivityTime(time) {
    const [hour, minute] = time.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${period}`;
}

function createScheduleCompletionCard(completion) {
    const card = document.createElement("article");
    card.className = "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3";

    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "font-medium";
    title.textContent = completion.title;
    const plan = document.createElement("p");
    plan.className = "mt-1 text-sm text-slate-400";
    plan.textContent = `${completion.day} · planned for ${formatActivityTime(completion.time)} · ${completion.type === "gym" ? "Gym" : "Life"}`;
    details.append(title, plan);

    const completedAt = document.createElement("time");
    completedAt.className = "text-xs text-slate-500";
    completedAt.dateTime = completion.completedAt;
    completedAt.textContent = new Date(completion.completedAt).toLocaleString();
    card.append(details, completedAt);
    return card;
}

function createRunCard(run) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5";

    const header = document.createElement("div");
    header.className = "flex flex-wrap items-center justify-between gap-2";
    const date = document.createElement("h3");
    date.className = "font-semibold";
    date.textContent = new Date(run.date).toLocaleString();
    const duration = document.createElement("p");
    duration.className = "font-mono text-sm tabular-nums text-slate-300";
    duration.textContent = formatDuration(run.durationSeconds);
    header.append(date, duration);

    const stats = document.createElement("dl");
    stats.className = "mt-4 grid grid-cols-3 gap-3";
    const entries = [
        ["Distance", `${run.distanceKm.toFixed(2)} km`],
        ["Pace", formatPace(run.durationSeconds, run.distanceKm)],
        ["Calories", `${Math.round(run.calories)} kcal`]
    ];
    for (const [label, value] of entries) {
        const item = document.createElement("div");
        item.className = "rounded-xl bg-slate-950/70 p-3";
        const term = document.createElement("dt");
        term.className = "text-xs text-slate-500";
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.className = "mt-1 text-sm font-medium text-slate-200";
        detail.textContent = value;
        item.append(term, detail);
        stats.append(item);
    }

    card.append(header, stats);
    return card;
}

function renderHistory() {
    const completions = readScheduleCompletions();
    const runs = readRuns();
    const totalDistance = runs.reduce((total, run) => total + run.distanceKm, 0);
    const totalCalories = runs.reduce((total, run) => total + run.calories, 0);
    const longestRun = runs.reduce((longest, run) => Math.max(longest, run.distanceKm), 0);

    document.querySelector("#total-runs").textContent = String(runs.length);
    document.querySelector("#total-distance").textContent = totalDistance.toFixed(2);
    document.querySelector("#total-calories").textContent = String(Math.round(totalCalories));
    document.querySelector("#longest-run").textContent = longestRun.toFixed(2);
    document.querySelector("#completed-activities").textContent = String(completions.length);
    document.querySelector("#completed-gym").textContent = String(completions.filter((completion) => completion.type === "gym").length);
    document.querySelector("#completed-life").textContent = String(completions.filter((completion) => completion.type === "life").length);
    runsList.replaceChildren();
    scheduleHistoryList.replaceChildren();

    if (completions.length === 0) {
        const empty = document.createElement("p");
        empty.className = "rounded-2xl border border-dashed border-slate-700 px-5 py-6 text-center text-sm text-slate-400";
        empty.textContent = "No completed schedule activities yet. Check off an activity in your weekly schedule and it will appear here.";
        scheduleHistoryList.append(empty);
    } else {
        [...completions]
            .sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt))
            .forEach((completion) => scheduleHistoryList.append(createScheduleCompletionCard(completion)));
    }

    if (runs.length === 0) {
        const empty = document.createElement("p");
        empty.className = "rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center text-slate-400";
        empty.textContent = "No finished runs yet. Complete a run and it will show up here.";
        runsList.append(empty);
        return;
    }

    [...runs]
        .sort((first, second) => Date.parse(second.date) - Date.parse(first.date))
        .forEach((run) => runsList.append(createRunCard(run)));
}

renderHistory();
