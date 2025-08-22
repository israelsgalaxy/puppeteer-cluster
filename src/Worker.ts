import Job, { JobData } from './Job';
import type Cluster from './Cluster';
import type { TaskFunction } from './Cluster';
import type { Page } from "patchright"
import { timeoutExecute, debugGenerator, log } from './util';
import { inspect } from 'util';
import { WorkerInstance, JobInstance } from './concurrency/ConcurrencyImplementation';

const debug = debugGenerator('Worker');

interface WorkerOptions {
    cluster: Cluster;
    args: string[];
    id: number;
    workerInstance: WorkerInstance;
}

const WORKER_INSTANCE_TRIES = 10;

export interface WorkError {
    type: 'error';
    error: Error;
}

export interface WorkData {
    type: 'success';
    data: any;
}

export type WorkResult = WorkError | WorkData;

export default class Worker<ReturnData> implements WorkerOptions {

    cluster: Cluster;
    args: string[];
    id: number;
    workerInstance: WorkerInstance;
    busy: boolean = false;

    activeTarget: Job<ReturnData> | null = null;

    public constructor({ cluster, args, id, workerInstance }: WorkerOptions) {
        this.cluster = cluster;
        this.args = args;
        this.id = id;
        this.workerInstance = workerInstance;

        debug(`Starting #${this.id}`);
    }

    public async handle(task: TaskFunction<ReturnData>, job: Job<ReturnData>, timeout: number): Promise<WorkResult> {
        this.activeTarget = job;

        let jobInstance: JobInstance | null = null;
        let page: Page | null = null;

        let tries = 0;

        while (jobInstance === null) {
            try {
                jobInstance = await this.workerInstance.jobInstance();
                page = jobInstance.resources.page;
            } catch (err: any) {
                debug(`Error getting worker page (try: ${tries}), message: ${err.message}`);
                await this.workerInstance.repair();
                tries += 1;
                if (tries >= WORKER_INSTANCE_TRIES) {
                    throw new Error('Unable to get worker page');
                }
            }
        }

        // We can be sure that page is set now, otherwise an exception would've been thrown
        page = page as Page; // this is just for TypeScript

        let errorState: Error | null = null;

        page.on('crash', (err) => {
            errorState = new Error('Page crash.');
            log(`Error (page crash) crawling ${inspect(job.data)}`);
        });

        debug(`Executing task on worker #${this.id} with data: ${inspect(job.data)}`);

        let result: any;
        try {
            result = await timeoutExecute(timeout, task({page, data: job.data as JobData, worker: {id: this.id}}));
        } catch (err: any) {
            errorState = err;
            log(`Error crawling ${inspect(job.data)} // message: ${err.message}`);
        }

        debug(`Finished executing task on worker #${this.id}`);

        try {
            await jobInstance.close();
        } catch (e: any) {
            debug(`Error closing worker instance for ${inspect(job.data)}: ${e.message}`);
            await this.workerInstance.repair();
        }

        this.activeTarget = null;

        if (errorState) {
            return {
                type: 'error',
                error: errorState || new Error('asf'),
            };
        }
        return {
            data: result,
            type: 'success',
        };
    }

    public async close(): Promise<void> {
        try {
            await this.workerInstance.close();
        } catch (err: any) {
            debug(`Unable to close worker instance. Error message: ${err.message}`);
        }
        debug(`Closed #${this.id}`);
    }

}
