import { ExecuteCallbacks, JobData } from './Job';
import type { LaunchOptions, Page } from "patchright";
import { EventEmitter } from 'events';
import { CustomBroswerContextOptions } from './concurrency/ConcurrencyImplementation';
interface ClusterOptions {
    concurrency: number;
    maxConcurrency: number;
    workerCreationDelay: number;
    monitor: boolean;
    timeout: number;
    retryLimit: number;
    retryDelay: number;
    launchOptions: LaunchOptions;
    contextOptions?: CustomBroswerContextOptions;
}
type Partial<T> = {
    [P in keyof T]?: T[P];
};
type ClusterOptionsArgument = Partial<ClusterOptions>;
interface TaskFunctionArguments {
    page: Page;
    data: JobData;
    worker: {
        id: number;
    };
}
export type TaskFunction<ReturnData> = (arg: TaskFunctionArguments) => Promise<ReturnData>;
export default class Cluster<ReturnData = any> extends EventEmitter {
    static CONCURRENCY_CONTEXT: number;
    private options;
    private workers;
    private workersBusy;
    private workersStarting;
    private allTargetCount;
    private jobQueue;
    private errorCount;
    private taskFunction;
    private idleResolvers;
    private waitForOneResolvers;
    private browser;
    private isClosed;
    private startTime;
    private nextWorkerId;
    private monitoringInterval;
    private display;
    private systemMonitor;
    private checkForWorkInterval;
    static launch(options: ClusterOptionsArgument): Promise<Cluster<any>>;
    private constructor();
    private init;
    private launchWorker;
    task(taskFunction: TaskFunction<ReturnData>): Promise<void>;
    private nextWorkCall;
    private workCallTimeout;
    private work;
    private doWork;
    private lastLaunchedWorkerTime;
    private allowedToStartWorker;
    queue(data: JobData, taskFunction?: TaskFunction<ReturnData>, callbacks?: ExecuteCallbacks): void;
    execute(data: JobData, taskFunction?: TaskFunction<ReturnData>): Promise<ReturnData>;
    idle(): Promise<void>;
    waitForOne(): Promise<JobData>;
    close(): Promise<void>;
    private monitor;
}
export {};
