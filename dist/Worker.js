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
const util_1 = require("./util");
const util_2 = require("util");
const debug = (0, util_1.debugGenerator)('Worker');
const WORKER_INSTANCE_TRIES = 10;
class Worker {
    constructor({ cluster, args, id, workerInstance }) {
        this.busy = false;
        this.activeTarget = null;
        this.cluster = cluster;
        this.args = args;
        this.id = id;
        this.workerInstance = workerInstance;
        debug(`Starting #${this.id}`);
    }
    handle(task, job, timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            this.activeTarget = job;
            let jobInstance = null;
            let page = null;
            let tries = 0;
            while (jobInstance === null) {
                try {
                    jobInstance = yield this.workerInstance.jobInstance();
                    page = jobInstance.resources.page;
                }
                catch (err) {
                    debug(`Error getting worker page (try: ${tries}), message: ${err.message}`);
                    yield this.workerInstance.repair();
                    tries += 1;
                    if (tries >= WORKER_INSTANCE_TRIES) {
                        throw new Error('Unable to get worker page');
                    }
                }
            }
            // We can be sure that page is set now, otherwise an exception would've been thrown
            page = page; // this is just for TypeScript
            let errorState = null;
            page.on('crash', (err) => {
                errorState = new Error('Page crash.');
                (0, util_1.log)(`Error (page crash) crawling ${(0, util_2.inspect)(job.data)}`);
            });
            debug(`Executing task on worker #${this.id} with data: ${(0, util_2.inspect)(job.data)}`);
            let result;
            try {
                result = yield (0, util_1.timeoutExecute)(timeout, task({ page, data: job.data, worker: { id: this.id, proxy: jobInstance.resources.proxy } }));
            }
            catch (err) {
                errorState = err;
                (0, util_1.log)(`Error crawling ${(0, util_2.inspect)(job.data)} // message: ${err.message}`);
            }
            debug(`Finished executing task on worker #${this.id}`);
            try {
                yield jobInstance.close();
            }
            catch (e) {
                debug(`Error closing worker instance for ${(0, util_2.inspect)(job.data)}: ${e.message}`);
                yield this.workerInstance.repair();
            }
            this.activeTarget = null;
            if (errorState) {
                return {
                    type: 'error',
                    error: errorState || new Error('asf'),
                    jobData: job.data
                };
            }
            return {
                data: result,
                type: 'success',
                jobData: job.data
            };
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.workerInstance.close();
            }
            catch (err) {
                debug(`Unable to close worker instance. Error message: ${err.message}`);
            }
            debug(`Closed #${this.id}`);
        });
    }
}
exports.default = Worker;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUlBLGlDQUE2RDtBQUM3RCwrQkFBK0I7QUFHL0IsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBYyxFQUFDLFFBQVEsQ0FBQyxDQUFDO0FBU3ZDLE1BQU0scUJBQXFCLEdBQUcsRUFBRSxDQUFDO0FBZ0JqQyxNQUFxQixNQUFNO0lBVXZCLFlBQW1CLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsY0FBYyxFQUFpQjtRQUp2RSxTQUFJLEdBQVksS0FBSyxDQUFDO1FBRXRCLGlCQUFZLEdBQTJCLElBQUksQ0FBQztRQUd4QyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO1FBRXJDLEtBQUssQ0FBQyxhQUFhLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFWSxNQUFNLENBQUMsSUFBOEIsRUFBRSxHQUFvQixFQUFFLE9BQWU7O1lBQ3JGLElBQUksQ0FBQyxZQUFZLEdBQUcsR0FBRyxDQUFDO1lBRXhCLElBQUksV0FBVyxHQUF1QixJQUFJLENBQUM7WUFDM0MsSUFBSSxJQUFJLEdBQWdCLElBQUksQ0FBQztZQUU3QixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7WUFFZCxPQUFPLFdBQVcsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDMUIsSUFBSSxDQUFDO29CQUNELFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQ3RELElBQUksR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztnQkFDdEMsQ0FBQztn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