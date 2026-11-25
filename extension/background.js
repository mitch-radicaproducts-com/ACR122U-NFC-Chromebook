import {OFF_READING, POLL_MESSAGE, pageMessage, readBridge} from './reading.mjs';

// The fetch stays in the service worker. A content script follows the page's
// CORS rules, and Airtable asking for 127.0.0.1 is a private-network request.
// The worker is woken by the content script, so it does not keep its own timer.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== POLL_MESSAGE) return;
    readBridge()
        .then((reading) => {
            sendResponse(pageMessage(reading));
        })
        .catch(() => {
            sendResponse(pageMessage(OFF_READING));
        });
    return true;
});
