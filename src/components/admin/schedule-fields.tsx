"use client";

const WEEKDAYS = [
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
];

export function daySummary(days: number[]) {
  if (days.length === 0 || days.length === 7) return "Every day";
  return WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.short).join(", ");
}

export function timeSummary(start: string | null, end: string | null) {
  if (!start || !end) return "All day";
  return `${clock(start)} – ${clock(end)}`;
}

function clock(value: string) {
  const [hourRaw, minute] = value.split(":");
  const hour = Number(hourRaw);
  if (!Number.isInteger(hour) || minute == null) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

export function DayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  function toggle(day: number) {
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort((a, b) => a - b));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value.length === 0}
          onClick={() => onChange([])}
          className={`h-10 rounded-lg px-3 text-sm font-medium ${value.length === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          Every day
        </button>
        {WEEKDAYS.map((day) => {
          const on = value.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day.value)}
              className={`h-10 min-w-12 rounded-lg px-3 text-sm font-medium ${on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">Pick days, or leave Every day selected. Sunday starts the week.</p>
    </div>
  );
}
