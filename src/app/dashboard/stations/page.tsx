import { StationSetup } from "@/components/admin/station-setup";

export default function StationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="gz-kicker text-cyan-800 dark:text-cyan-300">Setup</p>
        <h1 className="gz-title">Stations</h1>
        <p className="text-sm text-muted-foreground">Add stations, set how many controllers they have, and set their rates.</p>
      </div>
      <StationSetup />
    </div>
  );
}
