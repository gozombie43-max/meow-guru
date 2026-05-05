// backend/ai/test.js
import 'dotenv/config';
import { chatComplete } from './azureClient.js';

async function test() {
  try {
    console.log("Testing Azure AI connection...");
    const response = await chatComplete(
      "Say hello and tell me you are working correctly. Keep it to 1 sentence.",
      "gpt-4o"
    );
    console.log("✅ Success:", response);
  } catch (err) {
    console.error("❌ Failed:", err.message);
  }
}

test();