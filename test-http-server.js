#!/usr/bin/env node

import AuthenticatedHTTPServer from './http-server.js';

async function testServer() {
  console.log('Testing HTTP Server...');
  
  try {
    // Test server creation
    const server = new AuthenticatedHTTPServer({ 
      port: 0, // Use random port
      host: '127.0.0.1'
    });
    
    console.log('✅ Server instance created');
    
    // Test starting server
    await server.start();
    const address = server.httpServer.address();
    console.log(`✅ Server running on http://${address.address}:${address.port}`);
    
    // Test health endpoint
    const response = await fetch(`http://${address.address}:${address.port}/`);
    const data = await response.json();
    
    console.log('✅ Health endpoint response:');
    console.log(data);
    
    // Stop server
    await server.stop();
    console.log('✅ Server stopped');
    
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testServer();