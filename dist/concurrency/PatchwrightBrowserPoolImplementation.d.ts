import { BrowserPool } from '@crawlee/browser-pool';
import ConcurrencyImplementation, { ResourceData } from './ConcurrencyImplementation';
export default class PatchwrightBrowserPoolImplementation extends ConcurrencyImplementation {
    protected browser: BrowserPool | null;
    private static plugin;
    private repairing;
    private repairRequested;
    private openInstances;
    private waitingForRepairResolvers;
    private repair;
    init(): Promise<void>;
    close(): Promise<void>;
    protected createResources(): Promise<ResourceData>;
    protected freeResources(resources: ResourceData): Promise<void>;
    workerInstance(): Promise<{
        jobInstance: () => Promise<{
            resources: ResourceData;
            close: () => Promise<void>;
        }>;
        close: () => Promise<void>;
        repair: () => Promise<void>;
    }>;
}
