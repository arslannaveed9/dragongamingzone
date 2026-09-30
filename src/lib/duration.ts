import { AppError } from "@/lib/errors";
import type { AppSettings } from "@/services/settings-service";

export function assertDuration(
  minutes: number,
  rules: Pick<AppSettings["booking"], "minDurationMinutes" | "maxDurationMinutes" | "durationStepMinutes">,
) {
  if (!Number.isInteger(minutes)) {
    throw new AppError(400, "DURATION", "Duration must be a whole number of minutes.");
  }
  if (minutes < rules.minDurationMinutes) {
    throw new AppError(400, "DURATION", `Minimum booking duration is ${rules.minDurationMinutes} minutes.`);
  }
  if (minutes > rules.maxDurationMinutes) {
    throw new AppError(400, "DURATION", `Maximum booking duration is ${rules.maxDurationMinutes} minutes.`);
  }
  if (minutes % rules.durationStepMinutes !== 0) {
    throw new AppError(400, "DURATION", `Duration must be in ${rules.durationStepMinutes}-minute steps.`);
  }
}

export function assertStep(minutes: number, step: number) {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes % step !== 0) {
    throw new AppError(400, "DURATION", `Use a multiple of ${step} minutes.`);
  }
}
