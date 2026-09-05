const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');
db.all("SELECT id, name, price FROM products WHERE name LIKE '%LED%' OR name LIKE '%Lamp%'", (err, rows) => {
  if (err) { console.error(err); return; }
  if (rows.length === 0) { console.log('NO LED LAMP FOUND IN DB'); }
  else { rows.forEach(r => console.log(r.id + ' | ' + r.name + ' | ' + r.price)); }
  db.all("SELECT id, name FROM products WHERE category='Books'", (err2, books) => {
    if (err2) { console.error(err2); return; }
    console.log('--- BOOKS ---');
    books.forEach(r => console.log(r.id + ' | ' + r.name));
    db.close();
  });
});
