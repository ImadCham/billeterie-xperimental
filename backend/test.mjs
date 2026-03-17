
import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('../frontend/success.html', 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost:3000/success.html?qty=1&total=12.64&tier=Test&email=test@test.com&name=TestUser&payment_intent=pi_123'
});

dom.window.onerror = function(msg, file, line, col, error) {
  console.error('JS Error:', msg, 'at line:', line);
};

dom.window.onunhandledrejection = function(event) {
  console.error('Unhandled Rejection:', event.reason);
};

setTimeout(() => {
  console.log('DOM loaded. Checking elements:');
  console.log('order-id:', dom.window.document.getElementById('order-id')?.innerText);
  console.log('Done test.');
}, 2000);
