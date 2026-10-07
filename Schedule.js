const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const storageKey = "weekly-life-gym-schedule-v1";
const completionHistoryKey = "weekly-life-gym-completions-v1";
const defaultActivities = [
    { id: "mon-morning", day: "Monday", time: "07:00", title: "Morning routine", type: "life", done: false },
    { id: "mon-work", day: "Monday", time: "09:00", title: "Work / study", type: "life", done: false },
    { id: "mon-gym", day: "Monday", time: "18:00", title: "Gym — full body", type: "gym", done: false },
    { id: "tue-morning", day: "Tuesday", time: "07:00", title: "Morning routine", type: "life", done: false },
    { id: "tue-work", day: "Tuesday", time: "09:00", title: "Work / study", type: "life", done: false },
    { id: "tue-personal", day: "Tuesday", time: "18:00", title: "Personal time", type: "life", done: false },
    { id: "wed-morning", day: "Wednesday", time: "07:00", title: "Morning routine", type: "life", done: false },
    { id: "wed-work", day: "Wednesday", time: "09:00", title: "Work / study", type: "life", done: false },
    { id: "wed-gym", day: "Wednesday", time: "18:00", title: "Gym — upper body", type: "gym", done: false },
    { id: "thu-morning", day: "Thursday", time: "07:00", title: "Morning routine", type: "life", done: false },
    { id: "thu-work", day: "Thursday", time: "09:00", title: "Work / study", type: "life", done: false },
    { id: "thu-personal", day: "Thursday", time: "18:00", title: "Personal time", type: "life", done: false },
    { id: "fri-morning", day: "Friday", time: "07:00", title: "Morning routine", type: "life", done: false },
    { id: "fri-work", day: "Friday", time: "09:00", title: "Work / study", type: "life", done: false },
    { id: "fri-gym", day: "Friday", time: "18:00", title: "Gym — lower body", type: "gym", done: false },
    { id: "sat-errands", day: "Saturday", time: "10:00", title: "Errands / free time", type: "life", done: false },
    { id: "sat-gym", day: "Saturday", time: "15:00", title: "Gym — cardio & core", type: "gym", done: false },
    { id: "sun-reset", day: "Sunday", time: "10:00", title: "Rest and reset", type: "life", done: false },
    { id: "sun-plan", day: "Sunday", time: "17:00", title: "Plan the week", type: "life", done: false }
];

const weekGrid = document.querySelector("#week-grid");
const daySelect = document.querySelector("#activity-day");
const form = document.querySelector("#activity-form");
const message = document.querySelector("#schedule-message");
const gymCount = document.querySelector("#gym-count");
const timeControlsContainer = document.querySelector("#activity-time-controls");
let shouldSaveStarter = false;

for (const day of days) {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    daySelect.append(option);
}

function showMessage(text) {
    message.textContent = text;
    message.classList.remove("hidden");
}

function saveActivities() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(activities));
        message.classList.add("hidden");
    } catch {
        showMessage("Your changes could not be saved in this browser. Check your browser storage settings.");
    }
}

function recordCompletions(completedActivities) {
    if (completedActivities.length === 0) {
        return;
    }

    try {
        const saved = localStorage.getItem(completionHistoryKey);
        const completions = saved === null ? [] : JSON.parse(saved);
        if (!Array.isArray(completions)) {
            throw new Error("Saved schedule history has an unexpected format.");
        }
        const completedAt = new Date().toISOString();
        for (const activity of completedActivities) {
            completions.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                completedAt,
                title: activity.title,
                day: activity.day,
                time: activity.time,
                type: activity.type
            });
        }
        localStorage.setItem(completionHistoryKey, JSON.stringify(completions));
    } catch {
        showMessage("Activities were marked complete, but their completion could not be saved to history.");
    }
}

function readActivities() {
    let saved;
    try {
        saved = localStorage.getItem(storageKey);
    } catch {
        showMessage("Browser storage is unavailable. You can still use this schedule, but changes may not be saved.");
        return defaultActivities.map((activity) => ({ ...activity }));
    }

    if (saved === null) {
        shouldSaveStarter = true;
        return defaultActivities.map((activity) => ({ ...activity }));
    }

    try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every((activity) =>
            activity &&
            typeof activity.id === "string" &&
            days.includes(activity.day) &&
            typeof activity.time === "string" &&
            typeof activity.title === "string" &&
            (activity.type === "life" || activity.type === "gym") &&
            typeof activity.done === "boolean"
        )) {
            throw new Error("Saved schedule has an unexpected format.");
        }
        return parsed;
    } catch {
        showMessage("The saved schedule could not be read. Your starter schedule is shown; adding an activity will replace the unreadable saved data.");
        return defaultActivities.map((activity) => ({ ...activity }));
    }
}

let activities = readActivities();
if (shouldSaveStarter) {
    saveActivities();
}

function formatTime(time) {
    const [hour, minute] = time.split(":").map(Number);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function createTimeControls(initialTime = "") {
    const container = document.createElement("div");
    container.className = "grid grid-cols-[1fr_1fr_auto] gap-2";

    let hourValue = "";
    let minuteValue = "00";
    let periodValue = "AM";
    if (initialTime) {
        const [hour, minute] = initialTime.split(":").map(Number);
        hourValue = String(hour % 12 || 12);
        minuteValue = String(minute).padStart(2, "0");
        periodValue = hour >= 12 ? "PM" : "AM";
    }

    const hourInput = document.createElement("input");
    hourInput.type = "number";
    hourInput.name = "time-hour";
    hourInput.min = "1";
    hourInput.max = "12";
    hourInput.step = "1";
    hourInput.value = hourValue;
    hourInput.required = true;
    hourInput.placeholder = "Hour";
    hourInput.setAttribute("aria-label", "Start time hour");
    hourInput.className = "min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none";

    const minuteInput = document.createElement("input");
    minuteInput.type = "number";
    minuteInput.name = "time-minute";
    minuteInput.min = "0";
    minuteInput.max = "59";
    minuteInput.step = "1";
    minuteInput.value = minuteValue;
    minuteInput.required = true;
    minuteInput.placeholder = "Minute";
    minuteInput.setAttribute("aria-label", "Start time minute");
    minuteInput.className = "min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none";

    const periodSelect = document.createElement("select");
    periodSelect.name = "time-period";
    periodSelect.setAttribute("aria-label", "AM or PM");
    periodSelect.className = "rounded-xl border border-slate-700 bg-slate-950 px-2 py-2.5 text-slate-100 focus:border-cyan-400 focus:outline-none";
    for (const period of ["AM", "PM"]) {
        const option = document.createElement("option");
        option.value = period;
        option.textContent = period;
        periodSelect.append(option);
    }
    periodSelect.value = periodValue;

    container.append(hourInput, minuteInput, periodSelect);
    return container;
}

function to24HourTime(hour, minute, period) {
    const hour24 = Number(hour) % 12 + (period === "PM" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
}

timeControlsContainer.append(createTimeControls());

function createActivityRow(activity) {
    const row = document.createElement("li");
    row.className = "flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3";

    const details = document.createElement("div");
    details.className = "min-w-0 flex-1";
    const title = document.createElement("p");
    title.textContent = activity.title;
    title.className = activity.done ? "break-words text-sm text-slate-500 line-through" : "break-words text-sm font-medium text-slate-100";
    const meta = document.createElement("p");
    meta.className = "mt-1 text-xs text-slate-500";
    meta.textContent = `${formatTime(activity.time)} · ${activity.type === "gym" ? "Gym" : "Life"}`;
    details.append(title, meta);
    if (activity.done) {
        const status = document.createElement("p");
        status.className = "mt-1 text-xs font-medium text-emerald-300";
        status.textContent = "Completed";
        details.append(status);
    }

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit time";
    editButton.setAttribute("aria-label", `Edit time for ${activity.title}`);
    editButton.className = "shrink-0 rounded-lg px-2 py-1 text-xs text-cyan-300 transition hover:bg-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-cyan-300";
    editButton.addEventListener("click", () => {
        const timeInputs = createTimeControls(activity.time);
        timeInputs.classList.add("mt-2");
        timeInputs.querySelector('[name="time-hour"]').setAttribute("aria-label", `New hour for ${activity.title}`);
        timeInputs.querySelector('[name="time-minute"]').setAttribute("aria-label", `New minute for ${activity.title}`);
        timeInputs.querySelector('[name="time-period"]').setAttribute("aria-label", `New AM or PM for ${activity.title}`);

        const editorActions = document.createElement("div");
        editorActions.className = "mt-2 flex gap-2";
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.textContent = "Save";
        saveButton.className = "rounded-lg bg-cyan-400 px-2 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-300";
        saveButton.addEventListener("click", () => {
            const hourInput = timeInputs.querySelector('[name="time-hour"]');
            const minuteInput = timeInputs.querySelector('[name="time-minute"]');
            if (!hourInput.reportValidity() || !minuteInput.reportValidity()) {
                return;
            }
            activity.time = to24HourTime(hourInput.value, minuteInput.value, timeInputs.querySelector('[name="time-period"]').value);
            saveActivities();
            renderSchedule();
        });

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        cancelButton.className = "rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-100";
        cancelButton.addEventListener("click", renderSchedule);

        editorActions.append(saveButton, cancelButton);
        details.replaceChildren(title, timeInputs, editorActions);
        timeInputs.querySelector('[name="time-hour"]').focus();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${activity.title}`);
    removeButton.className = "shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-300";
    removeButton.addEventListener("click", () => {
        activities = activities.filter((item) => item.id !== activity.id);
        saveActivities();
        renderSchedule();
    });

    row.append(details, editButton, removeButton);
    return row;
}

function toggleDayCompletion(dayActivities) {
    if (dayActivities.length === 0) {
        return;
    }

    const shouldCompleteDay = dayActivities.some((activity) => !activity.done);
    const newlyCompleted = dayActivities.filter((activity) => !activity.done);
    for (const activity of dayActivities) {
        activity.done = shouldCompleteDay;
    }
    saveActivities();
    if (shouldCompleteDay) {
        recordCompletions(newlyCompleted);
    }
    renderSchedule();
}

function renderSchedule() {
    weekGrid.replaceChildren();
    for (const day of days) {
        const card = document.createElement("article");
        card.className = "rounded-2xl border border-slate-800 bg-slate-900 p-4";

        const dayActivities = activities
            .filter((activity) => activity.day === day)
            .sort((first, second) => first.time.localeCompare(second.time));

        const dayHeader = document.createElement("div");
        dayHeader.className = "mb-3 flex items-center justify-between gap-2";
        const heading = document.createElement("h3");
        heading.className = "text-sm font-semibold uppercase tracking-wide text-cyan-300";
        heading.textContent = day;

        const completeDayButton = document.createElement("button");
        completeDayButton.type = "button";
        completeDayButton.textContent = dayActivities.length > 0 && dayActivities.every((activity) => activity.done)
            ? "Undo day"
            : "Complete day";
        completeDayButton.disabled = dayActivities.length === 0;
        completeDayButton.setAttribute("aria-label", `${completeDayButton.textContent} (${day})`);
        completeDayButton.className = "shrink-0 rounded-lg bg-emerald-400 px-2 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-40";
        completeDayButton.addEventListener("click", () => toggleDayCompletion(dayActivities));
        dayHeader.append(heading, completeDayButton);

        const list = document.createElement("ul");
        list.className = "space-y-2";

        if (dayActivities.length === 0) {
            const empty = document.createElement("li");
            empty.className = "rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-500";
            empty.textContent = "Nothing planned yet";
            list.append(empty);
        } else {
            for (const activity of dayActivities) {
                list.append(createActivityRow(activity));
            }
        }

        card.append(dayHeader, list);
        weekGrid.append(card);
    }
    gymCount.textContent = activities.filter((activity) => activity.type === "gym").length;
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const hourInput = form.querySelector('[name="time-hour"]');
    const minuteInput = form.querySelector('[name="time-minute"]');
    if (!hourInput.reportValidity() || !minuteInput.reportValidity()) {
        return;
    }
    activities.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: formData.get("title").trim(),
        day: formData.get("day"),
        time: to24HourTime(formData.get("time-hour"), formData.get("time-minute"), formData.get("time-period")),
        type: formData.get("type"),
        done: false
    });
    saveActivities();
    form.reset();
    timeControlsContainer.replaceChildren(createTimeControls());
    renderSchedule();
});

renderSchedule();