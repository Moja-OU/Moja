// Test Azure OpenAI API Key
// Run: node test-openai.js

const { AzureOpenAI } = require('openai');
require('dotenv').config();

async function testAzureOpenAI() {
  console.log('=== Testing Azure OpenAI API Key ===\n');

  // Check if key exists
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  
  if (!apiKey) {
    console.error('❌ AZURE_OPENAI_KEY not found in .env file');
    process.exit(1);
  }
  
  if (!endpoint) {
    console.error('❌ AZURE_OPENAI_ENDPOINT not found in .env file');
    console.error('Example: https://your-resource-name.openai.azure.com');
    process.exit(1);
  }

  console.log(`✓ API Key found: ${apiKey.substring(0, 20)}...`);
  console.log(`✓ Endpoint: ${endpoint}`);
  console.log(`✓ Model: ${process.env.OPENAI_MODEL || 'gpt-4'}\n`);

  // Initialize Azure OpenAI client
  const openai = new AzureOpenAI({
    apiKey,
    endpoint,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
  });

  console.log('Testing API call...\n');

  try {
    // Simple test call
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello, Azure API is working!" in exactly those words.' }
      ],
      max_tokens: 50
    });

    const reply = response.choices[0].message.content;
    
    console.log('✅ SUCCESS! Azure OpenAI API is working!\n');
    console.log('Response:', reply);
    console.log('\nAPI Details:');
    console.log('- Model used:', response.model);
    console.log('- Tokens used:', response.usage?.total_tokens);
    console.log('\n✓ Your Azure OpenAI key is valid and working correctly!');

  } catch (error) {
    console.error('❌ FAILED! Azure OpenAI API Error:\n');
    
    if (error.status === 401) {
      console.error('Invalid API key. Please check your AZURE_OPENAI_KEY in .env file.');
    } else if (error.status === 404) {
      console.error('Endpoint or deployment not found.');
      console.error('- Check AZURE_OPENAI_ENDPOINT is correct');
      console.error('- Check OPENAI_MODEL matches your deployment name');
      console.error(`  Current model: ${process.env.OPENAI_MODEL || 'gpt-4'}`);
    } else if (error.status === 429) {
      console.error('Rate limit exceeded or quota exhausted. Check your Azure account.');
    } else {
      console.error('Error:', error.message);
      console.error('Status:', error.status);
      if (error.code) console.error('Code:', error.code);
    }
    
    process.exit(1);
  }
}

testAzureOpenAI();
