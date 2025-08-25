
import Job, { ExecuteCallbacks, ExecuteReject, ExecuteResolve, JobData } from './Job';
import Display from './Display';
import * as util from './util';
import Worker, { WorkResult } from './Worker';
import type { LaunchOptions, Page } from "patchright"

import Queue from './Queue';
import SystemMonitor from './SystemMonitor';
import { EventEmitter } from 'events';
import ConcurrencyImplementation, { WorkerInstance, CustomBroswerContextOptions, Proxy } from './concurrency/ConcurrencyImplementation';
import PatchwrightBrowserPoolImplementation from './concurrency/PatchwrightBrowserPoolImplementation';

const debug = util.debugGenerator('Cluster');

interface ClusterOptions {
    concurrency: number;
    maxConcurrency: number; // same as pool size
    workerCreationDelay: number;
    monitor: boolean;
    timeout: number;
    retryLimit: number;
    retryDelay: number;
    launchOptions: LaunchOptions;
    contextOptions?: CustomBroswerContextOptions;
    browserCount: number;
    taskQueueTimeout: number;
}

type Partial<T> = {
    [P in keyof T]?: T[P];
};

type ClusterOptionsArgument = Partial<ClusterOptions>;

const DEFAULT_OPTIONS: ClusterOptions = {
    concurrency: 2, // CONTEXT
    maxConcurrency: 1,
    workerCreationDelay: 0,
    monitor: false,
    timeout: 30 * 1000,
    retryLimit: 0,
    retryDelay: 0,
    launchOptions: {
        channel: "chrome",
        headless: true
    },
    contextOptions: undefined,
    browserCount: 3,
    taskQueueTimeout: 30
};

interface TaskFunctionArguments{
    page: Page;
    data: JobData;
    worker: {
        id: number;
        proxy?: Proxy;
    };
}

export type TaskFunction<ReturnData> = (
    arg: TaskFunctionArguments,
) => Promise<ReturnData>;

const MONITORING_DISPLAY_INTERVAL = 500;
const CHECK_FOR_WORK_INTERVAL = 100;
const WORK_CALL_INTERVAL_LIMIT = 10;

export default class Cluster<ReturnData = any> extends EventEmitter {

    static CONCURRENCY_CONTEXT = 2; // no cookie sharing (uses contexts)

    private options: ClusterOptions;
    private workers: Worker<ReturnData>[] = [];
    private workersBusy = 0;
    private workersStarting = 0;

    private allTargetCount = 0;
    private jobQueue: Queue<Job<ReturnData>> = new Queue<Job<ReturnData>>();
    private errorCount = 0;

    private taskFunction: TaskFunction<ReturnData> | null = null;
    private idleResolvers: (() => void)[] = [];
    private waitForOneResolvers: ((data:JobData) => void)[] = [];
    private browsers: ConcurrencyImplementation[] = [];
    private currentBrowserIndex = 0;

    private isClosed = false;
    private startTime = Date.now();
    private nextWorkerId = -1;

    private monitoringInterval: NodeJS.Timeout | null = null;
    private display: Display | null = null;

    private systemMonitor: SystemMonitor = new SystemMonitor();

    private checkForWorkInterval: NodeJS.Timeout | null = null;

    public static async launch(options: ClusterOptionsArgument) {
        debug('Launching');
        const cluster = new Cluster(options);
        await cluster.init();

        return cluster;
    }

    private constructor(options: ClusterOptionsArgument) {
        super();

        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
        };

        if (this.options.monitor) {
            this.monitoringInterval = setInterval(
                () => this.monitor(),
                MONITORING_DISPLAY_INTERVAL,
            );
        }
    }

    private async init() {
        for (let i = 0; i < this.options.browserCount; i++) {
            const browser = new PatchwrightBrowserPoolImplementation(this.options.launchOptions, this.options.contextOptions);
            await browser.init();
            this.browsers.push(browser);
        }

        if (this.options.monitor) {
            await this.systemMonitor.init();
        }

        for (let i = 0; i < this.options.maxConcurrency; ++i) {
            this.launchWorker();
        }

        // needed in case resources are getting free (like CPU/memory) to check if
        // can launch workers
        this.checkForWorkInterval = setInterval(() => this.work(), CHECK_FOR_WORK_INTERVAL);
    }

    private async launchWorker() {
        // signal, that we are starting a worker
        this.workersStarting += 1;
        this.nextWorkerId += 1;
        this.lastLaunchedWorkerTime = Date.now();

        const workerId = this.nextWorkerId;

        let workerInstance: WorkerInstance;
        try {
            workerInstance = await (this.browsers[this.currentBrowserIndex] as ConcurrencyImplementation).workerInstance();
            this.currentBrowserIndex = (this.currentBrowserIndex + 1 + this.options.browserCount) % this.options.browserCount;
        } catch (err: any) {
            throw new Error(`Unable to launch browser for worker, error message: ${err.message}`);
        }

        const worker = new Worker<ReturnData>({
            cluster: this,
            args: [''], // this.options.args,
            workerInstance: workerInstance,
            id: workerId,
        });
        this.workersStarting -= 1;

        if (this.isClosed) {
            // cluster was closed while we created a new worker (should rarely happen)
            try {
                await worker.close();
            } catch (err: any) {
                debug(`Error: Unable to close worker, message: ${err.message}`);
            }
        } else {
            this.workers.push(worker);
        }
    }

    public async task(taskFunction: TaskFunction<ReturnData>) {
        this.taskFunction = taskFunction;
    }

    private nextWorkCall: number = 0;
    private workCallTimeout: NodeJS.Timeout | null = null;

    // check for new work soon (wait if there will be put more data into the queue, first)
    private async work() {
        // make sure, we only call work once every WORK_CALL_INTERVAL_LIMIT (currently: 10ms)
        if (this.workCallTimeout === null) {
            const now = Date.now();

            // calculate when the next work call should happen
            this.nextWorkCall = Math.max(
                this.nextWorkCall + WORK_CALL_INTERVAL_LIMIT,
                now,
            );
            const timeUntilNextWorkCall = this.nextWorkCall - now;

            this.workCallTimeout = setTimeout(
                () => {
                    this.workCallTimeout = null;
                    this.doWork();
                },
                timeUntilNextWorkCall,
            );
        }
    }

    private async doWork() {
        if (this.jobQueue.size() === 0) { // no jobs available
            if (this.workersBusy === 0) {
                this.idleResolvers.forEach(resolve => resolve());
            }
            return;
        }

        if (this.workers.length === 0) { // no workers available
            if (this.allowedToStartWorker()) {
                await this.launchWorker();
                this.work();
            }
            return;
        }

        const job = this.jobQueue.shift();

        if (job === undefined) {
            // skip, there are items in the queue but they are all delayed
            return;
        }

        const timeInQueue = (Date.now() - job.createdAt);
        if (timeInQueue > this.options.taskQueueTimeout) {
            return;
        }

        const worker = this.workers.shift() as Worker<ReturnData>;
        worker.busy = true;
        this.workersBusy += 1;

        if (this.workers.length !== 0 || this.allowedToStartWorker()) {
            // we can execute more work in parallel
            this.work();
        }

        let jobFunction;
        if (job.taskFunction !== undefined) {
            jobFunction = job.taskFunction;
        } else if (this.taskFunction !== null) {
            jobFunction = this.taskFunction;
        } else {
            throw new Error('No task function defined!');
        }

        const result: WorkResult = await worker.handle(
            (jobFunction as TaskFunction<ReturnData>),
            job,
            this.options.timeout,
        );

        if (result.type === 'error') {
            if (job.executeCallbacks) {
                job.executeCallbacks.reject(result);
                this.errorCount += 1;
            } else { // ignore retryLimits in case of executeCallbacks
                job.addError(result.error);
                const jobWillRetry = job.tries <= this.options.retryLimit;
                this.emit('taskerror', result.error, job.data, jobWillRetry);
                if (jobWillRetry) {
                    let delayUntil = undefined;
                    if (this.options.retryDelay !== 0) {
                        delayUntil = Date.now() + this.options.retryDelay;
                    }
                    this.jobQueue.push(job, {
                        delayUntil,
                    });
                } else {
                    this.errorCount += 1;
                }
            }
        } else if (result.type === 'success' && job.executeCallbacks) {
            job.executeCallbacks.resolve(result);
        }

        this.waitForOneResolvers.forEach(
            resolve => resolve(job.data as JobData),
        );
        this.waitForOneResolvers = [];

        // add worker to available workers again
        worker.busy = false;
        this.workersBusy -= 1;

        try {
            await worker.close();
        } catch (err: any) {
            debug(`Error: Unable to close worker, message: ${err.message}`);
        }
        await this.launchWorker();

        this.work();
    }

    private lastLaunchedWorkerTime: number = 0;

    private allowedToStartWorker(): boolean {
        const workerCount = this.workers.length + this.workersStarting;
        return (
            // option: maxConcurrency
            (this.options.maxConcurrency === 0
                || workerCount < this.options.maxConcurrency)
            // just allow worker creaton every few milliseconds
            && (this.options.workerCreationDelay === 0
                || this.lastLaunchedWorkerTime + this.options.workerCreationDelay < Date.now())
        );
    }

    public queue(data: JobData, taskFunction?: TaskFunction<ReturnData>, callbacks?: ExecuteCallbacks): void {
        const job = new Job<ReturnData>(data, taskFunction, callbacks);

        this.allTargetCount += 1;
        this.jobQueue.push(job);
        this.emit('queue', data, taskFunction);
        this.work();
    }

    public execute(
        data: JobData,
        taskFunction?: TaskFunction<ReturnData>,
    ): Promise<ReturnData> {
        return new Promise<ReturnData>((resolve: ExecuteResolve, reject: ExecuteReject) => {
            const callbacks = { resolve, reject };
            this.queue(data, taskFunction, callbacks);
        });
    }

    public idle(): Promise<void> {
        return new Promise(resolve => this.idleResolvers.push(resolve));
    }

    public waitForOne(): Promise<JobData> {
        return new Promise(resolve  => this.waitForOneResolvers.push(resolve));
    }

    public async close(): Promise<void> {
        this.isClosed = true;

        clearInterval(this.checkForWorkInterval as NodeJS.Timeout);
        clearTimeout(this.workCallTimeout as NodeJS.Timeout);

        // close workers
        try {
            await Promise.all(this.workers.map(worker => worker.close()));
        } catch (err: any) {
            debug(`Error: Unable to close workers, message: ${err.message}`);
        }

        try {
            for (let i = 0; i < this.options.browserCount; i++)
                await (this.browsers[i] as ConcurrencyImplementation).close();
        } catch (err: any) {
            debug(`Error: Unable to close browser, message: ${err.message}`);
        }

        if (this.monitoringInterval) {
            this.monitor();
            clearInterval(this.monitoringInterval);
        }

        if (this.display) {
            this.display.close();
        }

        this.systemMonitor.close();

        debug('Closed');
    }

    private monitor(): void {
        if (!this.display) {
            this.display = new Display();
        }
        const display = this.display;

        const now = Date.now();
        const timeDiff = now - this.startTime;

        const doneTargets = this.allTargetCount - this.jobQueue.size() - this.workersBusy;
        const donePercentage = this.allTargetCount === 0
            ? 1 : (doneTargets / this.allTargetCount);
        const donePercStr = (100 * donePercentage).toFixed(2);

        const errorPerc = doneTargets === 0 ?
            '0.00' : (100 * this.errorCount / doneTargets).toFixed(2);

        const timeRunning = util.formatDuration(timeDiff);

        let timeRemainingMillis = -1;
        if (donePercentage !== 0) {
            timeRemainingMillis = ((timeDiff) / donePercentage) - timeDiff;
        }
        const timeRemining = util.formatDuration(timeRemainingMillis);

        const cpuUsage = this.systemMonitor.getCpuUsage().toFixed(1);
        const memoryUsage = this.systemMonitor.getMemoryUsage().toFixed(1);

        const pagesPerSecond = doneTargets === 0 ?
            '0' : (doneTargets * 1000 / timeDiff).toFixed(2);

        display.log(`== Start:     ${util.formatDateTime(this.startTime)}`);
        display.log(`== Now:       ${util.formatDateTime(now)} (running for ${timeRunning})`);
        display.log(`== Progress:  ${doneTargets} / ${this.allTargetCount} (${donePercStr}%)`
            + `, errors: ${this.errorCount} (${errorPerc}%)`);
        display.log(`== Remaining: ${timeRemining} (@ ${pagesPerSecond} pages/second)`);
        display.log(`== Sys. load: ${cpuUsage}% CPU / ${memoryUsage}% memory`);
        display.log(`== Workers:   ${this.workers.length + this.workersStarting}`);

        this.workers.forEach((worker, i) => {
            const isIdle = !worker.busy;
            let workOrIdle;
            let workerUrl = '';
            if (isIdle) {
                workOrIdle = 'IDLE';
            } else {
                workOrIdle = 'WORK';
                if (worker.activeTarget) {
                    workerUrl = worker.activeTarget.getUrl() || 'UNKNOWN TARGET';
                } else {
                    workerUrl = 'NO TARGET (should not be happening)';
                }
            }

            display.log(`   #${i} ${workOrIdle} ${workerUrl}`);
        });
        for (let i = 0; i < this.workersStarting; i += 1) {
            display.log(`   #${this.workers.length + i} STARTING...`);
        }

        display.resetCursor();
    }

}
