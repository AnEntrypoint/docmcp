#!/usr/bin/env node

import AuthenticatedHTTPServer from './http-server.js';

async function testPort3000() {
  console.log('Testing HTTP Server on port 3000...');
  
  try {
    const server = new AuthenticatedHTTPServer({ 
      port: 3000,
      host: '127.0.0.1'
    });
    
    await server.start();
    console.log('✅ Server started on port 3000');
    
    // Test health endpoint
    const response = await fetch('http://127.0.0.1:3000/');
    const data = await response.json();
    
    console.log('✅ Health endpoint response:');
    console.log(data);
    
    await server.stop();
    console.log('✅ Server stopped');
    
    console.log('\n🎉 Port 3000 test passed!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error('❌ Port 3000 is already in use');
    } else {
      console.error('❌ Test failed:', error.message);
    }
    process.exit(1);
  }
}

testPort3000();