# Gaming Zone

Staff system for a physical gaming zone: stations, walk-ins, reservations, pricing, discounts, and gaming-day reports. The public home page shows live availability.

## Run

1. Start MongoDB (`docker compose up -d` or a local instance).
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `AUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. `npm install`
4. `npm run dev`

The first sign-in creates the owner from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if the user collection is empty. There is no sample station data unless you run `SEED_DEV=true npm run seed`. That script is development-only.

`npm test` covers the gaming-day clock, pricing, and booking overlap rules.

## Decisions

- A gaming day runs from the configured start (default 09:00) until the configured end (default 03:00 the next morning) in `Asia/Karachi`, which is editable in Settings. 03:00 is the exclusive end. 03:00–09:00 is closed. During that gap, “current gaming day” means the day that just ended.
- All booking windows, timelines, and reports use `src/lib/gaming-day.ts`. A report date is a gaming day, not midnight-to-midnight.
- Prices are calculated only in `src/lib/pricing.ts`. Full hours use the hourly rate; the remainder is prorated from the 30-minute rate. The first controller is included. Extra controllers use a per-controller override or the station’s additional rate. One matching pricing rule can replace the base rate. One discount — the largest saving — is applied. Discounts are not stacked, and they follow the gaming day’s weekday.
- Overlap is half-open: a booking may start at the exact minute another ends. Writes for a station are serialized with a lock document so two cashiers cannot book the same slot at once, including on a standalone MongoDB server.
- Sessions that pass their end time are completed by a server interval and whenever the floor or public board is read. The browser countdown is display-only.
- Ending a session early rebills elapsed play time, rounded up to the duration step and not below the minimum. Pausing freezes remaining play time; resuming extends the held slot only when nothing else is booked and the extension still ends by closing.
- Bookings, payments, and product sales are not hard-deleted. Cancel keeps the record. Stations and products are archived.
- A POS sale is a separate order. Booking detail already sums gaming charges and attached product orders. The `Bill` model is reserved for a future single invoice.
- Roles are owner, admin, manager, and staff. Routes check permissions in `src/lib/permissions.ts` so later roles do not require a rewrite.
