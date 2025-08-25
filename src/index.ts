import * as express from 'express'
import Cluster, { TaskFunctionArguments } from "./Cluster";
import yargs, { number } from "yargs";
import { hideBin } from "yargs/helpers";
import { createClientPool } from "redis";

interface Arguments {
    max_concurrency: number;
    browser_count: number;
    task_queue_timeout: number;
    worker_timeout: number;
    worker_creation_delay: number;
    browser_type: string;
    headless: boolean;
    port: number;
    redis_ttl: number;
    proxy_domain: string;
    proxy_port: number;
    proxy_password: string;
    proxy_protocol: string;
    proxy_username: string;
    proxy_sid_length: number;
}

const argv = yargs(hideBin(process.argv))
    .option("max_concurrency", {
        alias: "c",
        type: "number",
        describe: "Maximum number of concurrent browser contexts per browser",
        default: 10,
    })
    .option("browser_count", {
        alias: "b",
        type: "number",
        describe: "The number of browser instances",
        default: 3,
    })
    .option("task_queue_timeout", {
        alias: "j",
        type: "number",
        describe: "The number of milliseconds after a task in the queue expires",
        default: 30 * 1000,
    })
    .option("worker_timeout", {
        alias: "t",
        type: "number",
        describe: "Worker timeout in ms",
        default: 100 * 1000,
    })
    .option("worker_creation_delay", {
        alias: "d",
        type: "number",
        describe: "Delay between worker creation in ms",
        default: 2000,
    })
    .option("browser_type", {
        alias: "B",
        choices: ["chrome", "chromium"],
        describe: "Browser type to use",
        default: "chrome",
    })
    .option("headless", {
        alias: "H",
        type: "boolean",
        describe: "Run browser in headless mode",
        default: false,
    })
    .option("port", {
        alias: "p",
        type: "number",
        describe: "Port to run the service on",
        default: 80,
    })
    .option("redis_ttl", {
        alias: "p",
        type: "number",
        describe: "Seconds for a job to expire in redis cache",
        default: 5 * 60,
    })
    .option("proxy_domain", {
        type: "string",
        describe: "Proxy domain or IP address",
        demandOption: true,
    })
    .option("proxy_port", {
        type: "number",
        describe: "Proxy port",
        demandOption: true,
    })
    .option("proxy_password", {
        type: "string",
        describe: "Proxy password",
        demandOption: true,
    })
    .option("proxy_protocol", {
        type: "string",
        choices: ["http", "https", "socks4", "socks5"],
        describe: "Proxy protocol to use",
        default: "http",
    })
    .option("proxy_username", {
        type: "string",
        describe: "Proxy username",
        demandOption: true,
    })
    .option("proxy_sid_length", {
        type: "number",
        describe: "Length of proxy session ID",
        default: 8,
    })
    .help()
    .parse() as Arguments;

const client = await createClientPool({url: "redis://localhost:6377"})
    .on("error", (err) => {
        throw Error("Redis Client Error", err);
    })
    .connect();

if (client === undefined) {
    throw Error("Redis Client is undefined");
}

function randomString(length: number) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: argv.max_concurrency,
    timeout: argv.worker_timeout,
    monitor: false,
    workerCreationDelay: argv.worker_creation_delay,
    taskQueueTimeout: argv.task_queue_timeout,
    browserCount: argv.browser_count,
    launchOptions: {
        channel: argv.browser_type,
        headless: argv.headless,
        args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--disable-software-rasterizer",

            "--disable-blink-features=AutomationControlled",  // avoid navigator.webdriver detection
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            '--disable-application-cache',
            '--disable-field-trial-config',
            '--export-tagged-pdf',
            '--force-color-profile=srgb',
            '--safebrowsing-disable-download-protection',
            '--disable-search-engine-choice-screen',
            '--disable-browser-side-navigation',
            '--disable-save-password-bubble',
            '--disable-single-click-autofill',
            '--allow-file-access-from-files',
            '--disable-prompt-on-repost',
            '--dns-prefetch-disable',
            '--disable-translate',
            '--disable-client-side-phishing-detection',
            '--disable-oopr-debug-crash-dump',
            '--disable-top-sites',
            '--ash-no-nudges',
            '--no-crash-upload',
            '--deny-permission-prompts',
            '--simulate-outdated-no-au="Tue, 31 Dec 2099 23:59:59 GMT"',
            '--disable-ipc-flooding-protection',
            '--disable-password-generation',
            '--disable-domain-reliability',
            '--disable-breakpad',
            // Allow Manifest V2 extensions
            // --disable-features=ExtensionManifestV2DeprecationWarning,ExtensionManifestV2Disabled,ExtensionManifestV2Unsupported
            '--disable-features=OptimizationHints,OptimizationHintsFetching,Translate,OptimizationTargetPrediction,OptimizationGuideModelDownloading,DownloadBubble,DownloadBubbleV2,InsecureDownloadWarnings,InterestFeedContentSuggestions,PrivacySandboxSettings4,SidePanelPinning,UserAgentClientHint',
            '--no-pings',
            // '--homepage=chrome://version/',
            '--animation-duration-scale=0',
            '--wm-window-animations-disabled',
            '--enable-privacy-sandbox-ads-apis',
            // '--disable-popup-blocking',
            '--lang=en-US',
            '--no-default-browser-check',
            '--no-first-run',
            '--no-service-autorun',
            '--password-store=basic',
            '--log-level=3',
            '--proxy-bypass-list=<-loopback>;localhost;127.0.0.1;*.local',

            // Not needed, here just for reference
            // Network/Connection Tuning
            '--enable-features=NetworkService,ParallelDownloading',
            '--max-connections=255',  // Total active connections
            '--max-parallel-downloads=50',  // Concurrent downloads
            '--socket-reuse-policy=2',  // Aggressive socket reuse

            // Thread/Process Management
            // '--renderer-process-limit=0',  // Unlimited renderers
            // '--in-process-gpu',  // Reduce process count // NO
            // '--disable-site-isolation-trials',  // Prevent tab grouping // NO

            // Protocol-Specific
            // '--http2-no-coalesce-host',  // Bypass HTTP/2 coalescing
            // '--force-http2-hpack-huffman=off',  // Reduce HPACK overhead
        ]
    },
    contextOptions: {
        proxyGenerator: () => {
            const protocol = "http";
            const username = argv.proxy_username.replace("${sid}", randomString(argv.proxy_sid_length));
            const password = argv.proxy_password;
            const domain = argv.proxy_domain;
            const port = argv.proxy_port;
            return {
                "server": `${protocol}://${domain}:${port}`,
                "username": username,
                "password": password
            };
        }
    }
});

console.log("Browser cluster initialized");

await cluster.task(processTurnstile);

const app = express();

app.get('/turnstile', queueTurnstile);

app.get('/result', result);

app.get('/', index);

app.listen(argv.port, function () {
    console.log(`Server listening on port ${argv.port}`);
});

async function queueTurnstile(req: express.Request, res: express.Response) {
    const url = <string>req.query.url;
    const sitekey = req.query.sitekey;

    if (url === undefined || sitekey === undefined) {
        await res.status(400).json({
            msg: "'url' and 'sitekey' are required"
        });
    }

    const id = crypto.randomUUID();

    const insertData = {
        id: id,
        status: 0, // queued
        created_at: new Date().toISOString(),
        proxy: null,
        cf_clearance: null,
        finished_at: null,
        user_agent: null,
        token: null
    };

    if (!client)
        throw new Error("Redis client is undefined");

    await client.setEx(id, argv.redis_ttl, JSON.stringify(insertData));

    try {
        await cluster.queue({url, sitekey, id}, undefined, {reject, resolve});
    } catch (error: any) {
        console.error(`Unexpected error queueing request: ${error.toString()}`);
        await res.status(500).json({
            msg: error.toString()
        });
    }

    console.log(`Request queued with id: ${id}`);
    await res.status(200).json({msg: id});
}

async function result(req: express.Request, res: express.Response) {
    const id = <string>req.query.id;

    if (id === undefined) {
        await res.status(400).json({
            msg: "'id' is required"
        });
        return;
    }

    if (!client)
        throw new Error("Redis client is undefined");

    const resultData = await client.get(id);
    const result = resultData ? JSON.parse(resultData) : null;

    if (result === null) {
        await res.status(400).json({
            msg:`"id ${id} not found`
        });
        return;
    }

    if (result.status === 0) {
        await res.status(204).json({
            msg: "in queue",
        });
        return;
    } else if (result.status === 1) {
        await res.status(200).json({
            msg: "solved",
            proxy: result.proxy,
            cf_clearance: result.cf_clearance,
            user_agent: result.user_agent,
            token: result.token
        });
        return;
    } else if (result.status === 2) {
        await res.status(422).json({
            msg: "failed"
        });
        return;
    }

    await res.status(500).json({
        msg: "server error"
    });
}

async function index(req: express.Request, res: express.Response) {
    await res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Turnstile Solver API</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-gray-200 min-h-screen flex items-center justify-center">
            <div class="bg-gray-800 p-8 rounded-lg shadow-md max-w-2xl w-full border border-red-500">
                <h1 class="text-3xl font-bold mb-6 text-center text-red-500">Welcome to Turnstile Solver API</h1>

                <p class="mb-4 text-gray-300">To use the turnstile service, send a GET request to 
                    <code class="bg-red-700 text-white px-2 py-1 rounded">/turnstile</code> with the following query parameters:</p>

                <ul class="list-disc pl-6 mb-6 text-gray-300">
                    <li><strong>url</strong>: The URL where Turnstile is to be validated</li>
                    <li><strong>sitekey</strong>: The site key for Turnstile</li>
                </ul>

                <div class="bg-gray-700 p-4 rounded-lg mb-6 border border-red-500">
                    <p class="font-semibold mb-2 text-red-400">Example usage:</p>
                    <code class="text-sm break-all text-red-300">/turnstile?url=https://example.com&sitekey=sitekey</code>
                </div>
            </div>
        </body>
        </html>
    `);
}

async function processTurnstile({page, data, worker}: TaskFunctionArguments) {
    const HTML_TEMPLATE = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Turnstile Solver</title>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async></script>
    </head>
    <body>
        <!-- cf turnstile -->
    </body>
    </html>
    `
    const startTime = Date.now();

    const id = data.id;
    const url = data.url;
    const sitekey = data.sitekey;

    let proxy = "None"
    if (worker.proxy !== undefined) {
        const { server, username, password } = worker.proxy;
        proxy = server.replace('://', `://${username}:${password}@`);
    }

    console.log(`Starting Turnstile solve for URL: ${url} with Sitekey: ${sitekey} and Proxy: ${proxy}`);
    console.log(`Setting up page data and route`);

    const urlWithSlash = url.endsWith("/") ? url : url + "/";
    const turnstileDiv = `<div class="cf-turnstile" style="background: white;" data-sitekey="${sitekey}"></div>`;
    const pageData = HTML_TEMPLATE.replace("<!-- cf turnstile -->", turnstileDiv);

    await page.route(urlWithSlash, route => route.fulfill({ body: pageData, status: 200 }));
    await page.goto(urlWithSlash);

    console.log(`Setting up Turnstile widget dimensions`);

    await page.locator("//div[@class='cf-turnstile']").evaluate(el => el.style.width = '70px');

    console.log(`Starting Turnstile response retrieval loop`);

    for (let i = 0; i < 10000; i++) {
        try {
            const turnstileCheck = await page.inputValue("[name=cf-turnstile-response]", { timeout: 5000 });
            if (turnstileCheck === "") {
                console.log(`Attempt ${i} - No Turnstile response yet`);
                
                await page.locator("//div[@class='cf-turnstile']").click({ timeout: 1000 });
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                const elapsedTime = Math.round((Date.now() - startTime) / 1000 * 1000) / 1000;

                console.log(`Successfully solved captcha - in ${elapsedTime} Seconds`);

                const cookies = await page.context().cookies();
                const cfClearance = cookies.find(x => x.name === "cf_clearance")?.value;
                const userAgent = await page.evaluate(() => navigator.userAgent);

                return { proxy, cfClearance, userAgent, turnstileCheck };
            }
        } catch {}
    }

    throw Error("Could not solve after looping many times")
}

async function resolve(result: any) {
    if (!client)
        throw new Error("Redis client is undefined");

    const existingData = await client.get(result.jobData.id);

    if (existingData) {
        const parsedData = JSON.parse(existingData);
        
        parsedData.status = 1;
        parsedData.finished_at = new Date().toISOString();
        parsedData.proxy = result.data.proxy;
        parsedData.cf_clearance = result.data.cfClearance;
        parsedData.user_agent = result.data.userAgent;
        parsedData.token = result.data.turnstileCheck;
        
        await client.set(result.jobData.id, JSON.stringify(parsedData), { KEEPTTL: true });
    }
}

async function reject(result: any) {
    if (!client)
        throw new Error("Redis client is undefined");

    const existingDataFailed = await client.get(result.jobData.id);

    if (existingDataFailed) {
        const parsedDataFailed = JSON.parse(existingDataFailed);
        
        parsedDataFailed.status = 2;
        parsedDataFailed.finished_at = new Date().toISOString();
        
        await client.set(result.jobData.id, JSON.stringify(parsedDataFailed), { KEEPTTL: true });
    }
}
