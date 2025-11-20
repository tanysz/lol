// Persistent State Service untuk menyimpan state ke JSON file

import fs from "fs";
import path from "path";

interface AppState {
  aiEnabled: boolean;
  lastUpdated: number;
  updatedBy?: string;
}

class PersistentStateService {
  private stateFilePath: string;
  private state: AppState;
  private readonly DEFAULT_STATE: AppState = {
    aiEnabled: true,
    lastUpdated: Date.now(),
  };

  constructor() {
    // Path to state file
    this.stateFilePath = path.join(process.cwd(), "data", "app-state.json");

    // Load state from file or use default
    this.state = this.loadState();

    console.log(`[PersistentState] Loaded state: AI ${this.state.aiEnabled ? "ON" : "OFF"}`);
  }

  /**
   * Load state from JSON file
   */
  private loadState(): AppState {
    try {
      // Create data directory if not exists
      const dataDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Check if state file exists
      if (fs.existsSync(this.stateFilePath)) {
        const fileContent = fs.readFileSync(this.stateFilePath, "utf-8");
        const loadedState = JSON.parse(fileContent) as AppState;
        
        console.log(`[PersistentState] State file found. AI status: ${loadedState.aiEnabled ? "ON" : "OFF"}`);
        
        return loadedState;
      } else {
        // Create new state file with default
        console.log("[PersistentState] No state file found. Creating new with default (AI ON)");
        this.saveState(this.DEFAULT_STATE);
        return this.DEFAULT_STATE;
      }
    } catch (error) {
      console.error("[PersistentState] Error loading state:", error);
      console.log("[PersistentState] Using default state (AI ON)");
      return this.DEFAULT_STATE;
    }
  }

  /**
   * Save state to JSON file
   */
  private saveState(state: AppState): void {
    try {
      const dataDir = path.dirname(this.stateFilePath);
      
      // Ensure directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Write state to file
      fs.writeFileSync(
        this.stateFilePath,
        JSON.stringify(state, null, 2),
        "utf-8"
      );

      console.log(`[PersistentState] State saved: AI ${state.aiEnabled ? "ON" : "OFF"}`);
    } catch (error) {
      console.error("[PersistentState] Error saving state:", error);
    }
  }

  /**
   * Set AI status and save to file
   */
  setAIStatus(enabled: boolean, updatedBy?: string): void {
    this.state = {
      aiEnabled: enabled,
      lastUpdated: Date.now(),
      updatedBy,
    };

    this.saveState(this.state);
  }

  /**
   * Get current AI status
   */
  getAIStatus(): boolean {
    return this.state.aiEnabled;
  }

  /**
   * Get full state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get state info as readable string
   */
  getStateInfo(): string {
    const lastUpdatedDate = new Date(this.state.lastUpdated);
    const timeSince = Date.now() - this.state.lastUpdated;
    const minutesAgo = Math.floor(timeSince / 60000);
    
    let info = `Status: ${this.state.aiEnabled ? "🟢 ON" : "🔴 OFF"}\n`;
    info += `Last Updated: ${lastUpdatedDate.toLocaleString()}`;
    
    if (minutesAgo < 60) {
      info += ` (${minutesAgo} minutes ago)`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      info += ` (${hoursAgo} hours ago)`;
    }
    
    if (this.state.updatedBy) {
      info += `\nUpdated By: ${this.state.updatedBy}`;
    }
    
    return info;
  }

  /**
   * Reset to default state
   */
  reset(): void {
    console.log("[PersistentState] Resetting to default state");
    this.state = { ...this.DEFAULT_STATE };
    this.saveState(this.state);
  }

  /**
   * Get file path (for debugging)
   */
  getFilePath(): string {
    return this.stateFilePath;
  }
}

// Export singleton instance
export const persistentStateService = new PersistentStateService();
