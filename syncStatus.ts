import { App } from "obsidian";

const NUTSTORE_PLUGIN_ID = "nutstore-sync";
// Device-local (not synced) so each device remembers its own last sync.
const STORAGE_KEY = "obsidian-home-nutstore-last-sync";

// Nutstore Sync has no public API: it only keeps the last sync time in memory on
// its status service and rewrites its status bar item when a sync ends. Access
// is fully defensive so an internal change just hides the indicator.
interface NutstoreStatusService {
	lastSyncTime?: number | null;
	syncStatusBar?: HTMLElement | null;
}

interface AppWithPlugins {
	plugins?: { plugins?: Record<string, { statusService?: NutstoreStatusService } | undefined> };
}

export class NutstoreSyncWatcher {
	private observer: MutationObserver | null = null;

	constructor(private app: App, private onSync: () => void) {}

	// Call after layout ready, when all plugins have loaded.
	start() {
		const statusBar = this.getStatusService()?.syncStatusBar;
		if (!statusBar) return;
		this.observer = new MutationObserver(() => this.captureSyncTime());
		this.observer.observe(statusBar, { childList: true, characterData: true, subtree: true });
		this.captureSyncTime();
	}

	stop() {
		this.observer?.disconnect();
		this.observer = null;
	}

	// Null when Nutstore Sync isn't enabled or has never synced on this device.
	getLastSyncTime(): number | null {
		if (!this.getStatusService()) return null;
		const stored = this.app.loadLocalStorage(STORAGE_KEY);
		return typeof stored === "number" ? stored : null;
	}

	private captureSyncTime() {
		const time = this.getStatusService()?.lastSyncTime;
		if (typeof time !== "number" || time === this.getLastSyncTime()) return;
		this.app.saveLocalStorage(STORAGE_KEY, time);
		this.onSync();
	}

	private getStatusService(): NutstoreStatusService | null {
		const plugins = (this.app as unknown as AppWithPlugins).plugins?.plugins;
		return plugins?.[NUTSTORE_PLUGIN_ID]?.statusService ?? null;
	}
}
