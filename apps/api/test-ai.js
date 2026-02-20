require('dotenv').config();
const { AzureOpenAI } = require('openai');

async function test() {
    console.log('\n=== Testing Azure OpenAI with tools ===');
    console.log('Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('Model:', process.env.OPENAI_MODEL);
    console.log('API Version:', process.env.AZURE_OPENAI_API_VERSION);
    console.log('Key present:', !!process.env.AZURE_OPENAI_KEY);

    const client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
    });

    // Test 1: Simple chat (no tools)
    try {
        console.log('\n--- Test 1: Simple chat ---');
        const r = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
            messages: [{ role: 'user', content: 'Say hello' }],
        });
        console.log('✅ Success:', r.choices[0].message.content);
    } catch (e) {
        console.error('❌ Failed:', e.message, e.status, e.code);
    }

    // Test 2: Chat with tools (same as AIOrchestrator)
    try {
        console.log('\n--- Test 2: Chat with tools ---');
        const tools = [
            {
                type: 'function',
                function: {
                    name: 'perform_search',
                    description: 'Search the web',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'execute_actions',
                    description: 'Execute actions',
                    parameters: {
                        type: 'object',
                        properties: {
                            assistant_message: { type: 'string' },
                            missing_fields: { type: 'array', items: { type: 'string' } },
                            actions: { type: 'array', items: { type: 'object' } }
                        },
                        required: ['assistant_message', 'missing_fields', 'actions']
                    }
                }
            }
        ];

        const r = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'hello' }
            ],
            tools: tools,
            tool_choice: 'auto',
        });
        console.log('✅ Success:', r.choices[0].message.content);
        console.log('   Tool calls:', r.choices[0].message.tool_calls);
    } catch (e) {
        console.error('❌ Failed:', e.message);
        console.error('   Status:', e.status);
        console.error('   Code:', e.code);
        console.error('   Full error:', JSON.stringify(e, null, 2));
    }

    // Test 3: Tavily
    try {
        console.log('\n--- Test 3: Tavily ---');
        const { tavily } = require('@tavily/core');
        const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
        const result = await tvly.search('test', { maxResults: 1 });
        console.log('✅ Tavily works:', result.results[0]?.title);
    } catch (e) {
        console.error('❌ Tavily failed:', e.message);
    }
}

test().catch(e => console.error('Fatal:', e));
