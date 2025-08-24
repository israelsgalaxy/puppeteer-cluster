import { Browser, LaunchOptions } from 'patchright';
import ConcurrencyImplementation, { ResourceData, CustomBroswerContextOptions } from './ConcurrencyImplementation';
export default class PatchwrightBrowserPoolImplementation extends ConcurrencyImplementation {
    protected browser: Browser | null;
    private repairing;
    private repairRequested;
    private openInstances;
    private waitingForRepairResolvers;
    constructor(launchOptions: LaunchOptions, contextOptions?: CustomBroswerContextOptions);
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
