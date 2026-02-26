#!/usr/bin/env node

import AuthenticatedHTTPServer from './http-server.js';

async function testStatusEndpoint() {
  console.log('Testing HTTP Server Status Endpoint...');
  
  try {
    const server = new AuthenticatedHTTPServer({ 
      port: 0,
      host: '127.0.0.1'
    });
    
    await server.start();
    const address = server.httpServer.address();
    
    console.log('✅ Server started');
    
    // Test status endpoint
    const statusResponse = await fetch(`http://${address.address}:${address.port}/status`);
    const statusData = await statusResponse.json();
    
    console.log('✅ Status endpoint response:');
    console.log(statusData);
    
    await server.stop();
    console.log('✅ Server stopped');
    
    console.log('\n🎉 Status endpoint test passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testStatusEndpoint();