/**
 * Quick test to verify Tavily API is working independently.
 * Run: node test-tavily.js
 */
const { tavily } = require("@tavily/core");

// Load env from parent api directory
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const apiKey = process.env.TAVILY_API_KEY;
if (!apiKey) {
    console.error("❌ TAVILY_API_KEY not found in .env");
    process.exit(1);
}

console.log("🔍 Testing Tavily API...\n");

const tvly = tavily({ apiKey });

tvly.search("news in rwanda today", { maxResults: 3 })
    .then(r => {
        console.log("✅ Tavily is working! Results:\n");
        r.results.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.title}`);
            console.log(`     URL: ${item.url}`);
            console.log(`     Snippet: ${item.content?.substring(0, 120)}...`);
            console.log();
        });
    })
    .catch(e => console.error("❌ Tavily error:", e.message));
