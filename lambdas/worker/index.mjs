import { withMonitoring } from "./monitoring.mjs";

async function actualHandler(event, context) {
    console.log(`Lambda ${context.awsRequestId} is processing...`);

    // Simulate some work (e.g., sleeping for a random duration)
    const randomSleep = Math.floor(Math.random() * 10) + 1;
    await new Promise((resolve) => setTimeout(resolve, randomSleep * 1000));

    return {
        statusCode: 200,
        body: "Work completed!",
    };
}

// Export the handler wrapped with monitoring
export const handler = withMonitoring(actualHandler);
