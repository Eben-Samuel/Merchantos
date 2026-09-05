const db = require('better-sqlite3')('data.db');
const rows = db.prepare("SELECT id, name, price FROM products WHERE category='Home & Kitchen' AND name LIKE '%LED%'").all();
console.log('LED products:', rows.length);
rows.forEach(r => console.log(r.id, '|', r.name, '|', r.price));
const books = db.prepare("SELECT id, name FROM products WHERE category='Books'").all();
console.log('\nBooks:');
books.forEach(r => console.log(r.id, '|', r.name));
db.close();
