"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Job_1 = require("./Job");
const Display_1 = require("./Display");
const util = require("./util");
const Worker_1 = require("./Worker");
const Queue_1 = require("./Queue");
const SystemMonitor_1 = require("./SystemMonitor");
const events_1 = require("events");
const PatchwrightBrowserPoolImplementation_1 = require("./concurrency/PatchwrightBrowserPoolImplementation");
const debug = util.debugGenerator('Cluster');
const DEFAULT_OPTIONS = {
    concurrency: 2, // CONTEXT
    maxConcurrency: 1,
    workerCreationDelay: 0,
    monitor: false,
    timeout: 30 * 1000,
    retryLimit: 0,
    retryDelay: 0,
};
const MONITORING_DISPLAY_INTERVAL = 500;
const CHECK_FOR_WORK_INTERVAL = 100;
const WORK_CALL_INTERVAL_LIMIT = 10;
class Cluster extends events_1.EventEmitter {
    static launch(options) {
        return __awaiter(this, void 0, void 0, function* () {
            debug('Launching');
            const cluster = new Cluster(options);
            yield cluster.init();
            return cluster;
        });
    }
    constructor(options) {
        super();
        this.workers = [];
        this.workersBusy = 0;
        this.workersStarting = 0;
        this.allTargetCount = 0;
        this.jobQueue = new Queue_1.default();
        this.errorCount = 0;
        this.taskFunction = null;
        this.idleResolvers = [];
        this.waitForOneResolvers = [];
        this.browser = null;
        this.isClosed = false;
        this.startTime = Date.now();
        this.nextWorkerId = -1;
        this.monitoringInterval = null;
        this.display = null;
        this.systemMonitor = new SystemMonitor_1.default();
        this.checkForWorkInterval = null;
        this.nextWorkCall = 0;
        this.workCallTimeout = null;
        this.lastLaunchedWorkerTime = 0;
        this.options = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
        if (this.options.monitor) {
            this.monitoringInterval = setInterval(() => this.monitor(), MONITORING_DISPLAY_INTERVAL);
        }
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.options.concurrency === Cluster.CONCURRENCY_CONTEXT) {
                this.browser = new PatchwrightBrowserPoolImplementation_1.default();
            }
            else {
                throw new Error(`Unknown concurrency option: ${this.options.concurrency}`);
            }
            if (typeof this.options.maxConcurrency !== 'number') {
                throw new Error('maxConcurrency must be of number type');
            }
            try {
                yield ((_a = this.browser) === null || _a === void 0 ? void 0 : _a.init());
            }
            catch (err) {
                throw new Error(`Unable to launch browser, error message: ${err.message}`);
            }
            if (this.options.monitor) {
                yield this.systemMonitor.init();
            }
            for (let i = 0; i < this.options.maxConcurrency; ++i) {
                this.launchWorker();
            }
            // needed in case resources are getting free (like CPU/memory) to check if
            // can launch workers
            this.checkForWorkInterval = setInterval(() => this.work(), CHECK_FOR_WORK_INTERVAL);
        });
    }
    launchWorker() {
        return __awaiter(this, void 0, void 0, function* () {
            // signal, that we are starting a worker
            this.workersStarting += 1;
            this.nextWorkerId += 1;
            this.lastLaunchedWorkerTime = Date.now();
            const workerId = this.nextWorkerId;
            let workerInstance;
            try {
                workerInstance = yield this.browser.workerInstance();
            }
            catch (err) {
                throw new Error(`Unable to launch browser for worker, error message: ${err.message}`);
            }
            const worker = new Worker_1.default({
                cluster: this,
                args: [''], // this.options.args,
                workerInstance: workerInstance,
                id: workerId,
            });
            this.workersStarting -= 1;
            if (this.isClosed) {
                // cluster was closed while we created a new worker (should rarely happen)
                worker.close();
            }
            else {
                this.workers.push(worker);
            }
        });
    }
    task(taskFunction) {
        return __awaiter(this, void 0, void 0, function* () {
            this.taskFunction = taskFunction;
        });
    }
    // check for new work soon (wait if there will be put more data into the queue, first)
    work() {
        return __awaiter(this, void 0, void 0, function* () {
            // make sure, we only call work once every WORK_CALL_INTERVAL_LIMIT (currently: 10ms)
            if (this.workCallTimeout === null) {
                const now = Date.now();
                // calculate when the next work call should happen
                this.nextWorkCall = Math.max(this.nextWorkCall + WORK_CALL_INTERVAL_LIMIT, now);
                const timeUntilNextWorkCall = this.nextWorkCall - now;
                this.workCallTimeout = setTimeout(() => {
                    this.workCallTimeout = null;
                    this.doWork();
                }, timeUntilNextWorkCall);
            }
        });
    }
    doWork() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.jobQueue.size() === 0) { // no jobs available
                if (this.workersBusy === 0) {
                    this.idleResolvers.forEach(resolve => resolve());
                }
                return;
            }
            if (this.workers.length === 0) { // no workers available
                if (this.allowedToStartWorker()) {
                    yield this.launchWorker();
                    this.work();
                }
                return;
            }
            const job = this.jobQueue.shift();
            if (job === undefined) {
                // skip, there are items in the queue but they are all delayed
                return;
            }
            const worker = this.workers.shift();
            worker.busy = true;
            ++this.workersBusy;
            if (this.workers.length !== 0 || this.allowedToStartWorker()) {
                // we can execute more work in parallel
                this.work();
            }
            let jobFunction;
            if (job.taskFunction !== undefined) {
                jobFunction = job.taskFunction;
            }
            else if (this.taskFunction !== null) {
                jobFunction = this.taskFunction;
            }
            else {
                throw new Error('No task function defined!');
            }
            const result = yield worker.handle(jobFunction, job, this.options.timeout);
            if (result.type === 'error') {
                if (job.executeCallbacks) {
                    job.executeCallbacks.reject(result.error);
                    this.errorCount += 1;
                }
                else { // ignore retryLimits in case of executeCallbacks
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
                    }
                    else {
                        this.errorCount += 1;
                    }
                }
            }
            else if (result.type === 'success' && job.executeCallbacks) {
                job.executeCallbacks.resolve(result.data);
            }
            this.waitForOneResolvers.forEach(resolve => resolve(job.data));
            this.waitForOneResolvers = [];
            // add worker to available workers again
            worker.busy = false;
            --this.workersBusy;
            yield worker.close();
            yield this.launchWorker();
            this.work();
        });
    }
    allowedToStartWorker() {
        const workerCount = this.workers.length + this.workersStarting;
        return (
        // option: maxConcurrency
        (this.options.maxConcurrency === 0
            || workerCount < this.options.maxConcurrency)
            // just allow worker creaton every few milliseconds
            && (this.options.workerCreationDelay === 0
                || this.lastLaunchedWorkerTime + this.options.workerCreationDelay < Date.now()));
    }
    queue(data, taskFunction, callbacks) {
        const job = new Job_1.default(data, taskFunction, callbacks);
        this.allTargetCount += 1;
        this.jobQueue.push(job);
        this.emit('queue', data, taskFunction);
        this.work();
    }
    execute(data, taskFunction) {
        return new Promise((resolve, reject) => {
            const callbacks = { resolve, reject };
            this.queue(data, taskFunction, callbacks);
        });
    }
    idle() {
        return new Promise(resolve => this.idleResolvers.push(resolve));
    }
    waitForOne() {
        return new Promise(resolve => this.waitForOneResolvers.push(resolve));
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isClosed = true;
            clearInterval(this.checkForWorkInterval);
            clearTimeout(this.workCallTimeout);
            // close workers
            yield Promise.all(this.workers.map(worker => worker.close()));
            try {
                yield this.browser.close();
            }
            catch (err) {
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
        });
    }
    monitor() {
        if (!this.display) {
            this.display = new Display_1.default();
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
            }
            else {
                workOrIdle = 'WORK';
                if (worker.activeTarget) {
                    workerUrl = worker.activeTarget.getUrl() || 'UNKNOWN TARGET';
                }
                else {
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
Cluster.CONCURRENCY_CONTEXT = 2; // no cookie sharing (uses contexts)
exports.default = Cluster;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2x1c3Rlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9DbHVzdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQ0EsK0JBQXNGO0FBQ3RGLHVDQUFnQztBQUNoQywrQkFBK0I7QUFDL0IscUNBQThDO0FBRzlDLG1DQUE0QjtBQUM1QixtREFBNEM7QUFDNUMsbUNBQXNDO0FBRXRDLDZHQUFzRztBQUV0RyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBa0I3QyxNQUFNLGVBQWUsR0FBbUI7SUFDcEMsV0FBVyxFQUFFLENBQUMsRUFBRSxVQUFVO0lBQzFCLGNBQWMsRUFBRSxDQUFDO0lBQ2pCLG1CQUFtQixFQUFFLENBQUM7SUFDdEIsT0FBTyxFQUFFLEtBQUs7SUFDZCxPQUFPLEVBQUUsRUFBRSxHQUFHLElBQUk7SUFDbEIsVUFBVSxFQUFFLENBQUM7SUFDYixVQUFVLEVBQUUsQ0FBQztDQUNoQixDQUFDO0FBY0YsTUFBTSwyQkFBMkIsR0FBRyxHQUFHLENBQUM7QUFDeEMsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLENBQUM7QUFDcEMsTUFBTSx3QkFBd0IsR0FBRyxFQUFFLENBQUM7QUFFcEMsTUFBcUIsT0FBMEIsU0FBUSxxQkFBWTtJQTZCeEQsTUFBTSxDQUFPLE1BQU0sQ0FBQyxPQUErQjs7WUFDdEQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ25CLE1BQU0sT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO1lBRXJCLE9BQU8sT0FBTyxDQUFDO1FBQ25CLENBQUM7S0FBQTtJQUVELFlBQW9CLE9BQStCO1FBQy9DLEtBQUssRUFBRSxDQUFDO1FBakNKLFlBQU8sR0FBeUIsRUFBRSxDQUFDO1FBQ25DLGdCQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLG9CQUFlLEdBQUcs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