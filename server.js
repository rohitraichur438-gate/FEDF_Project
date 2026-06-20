const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dbPath = path.join(__dirname, 'data', 'db.json');

const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// Get all rooms
app.get('/api/rooms', (req, res) => {
  const db = readDB();
  res.json(db.rooms);
});

// Assign room (just returns an available room based on preference – not used if user selects manually)
app.post('/api/assign-room', (req, res) => {
  const { preference } = req.body;
  const db = readDB();
  let available = db.rooms.filter(r => r.available);
  if (preference && preference !== 'any') {
    available = available.filter(r => r.view === preference);
  }
  const room = available.length > 0 ? available[0] : null;
  res.json({ room });
});

// Check-in (creates a new guest or reuses existing, and creates a stay)
app.post('/api/checkin', (req, res) => {
  const { guest, idBase64, roomId, checkinDate, password } = req.body;
  const db = readDB();

  // Check if guest already exists with same email
  let existingGuest = db.guests.find(g => g.email === guest.email);
  let newGuest;
  if (existingGuest) {
    // Update existing guest with new details if changed
    existingGuest.name = guest.name;
    existingGuest.phone = guest.phone;
    existingGuest.password = password; // update password
    existingGuest.idImage = idBase64;
    newGuest = existingGuest;
  } else {
    newGuest = {
      id: Date.now(),
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      password: password,
      idImage: idBase64
    };
    db.guests.push(newGuest);
  }

  const room = db.rooms.find(r => r.id === roomId);
  if (!room || !room.available) return res.status(400).json({ error: 'Room not available' });
  room.available = false;

  const stay = {
    id: Date.now(),
    guestId: newGuest.id,
    roomId: room.id,
    roomNumber: room.number,
    roomRate: room.rate,
    checkinDate,
    checkoutDate: null,
    totalBill: 0,
    comments: '',
    status: 'active'
  };
  db.stays.push(stay);

  writeDB(db);
  res.json({
    success: true,
    guest: newGuest,
    stay,
    digitalKey: `KEY-${room.number}-${Date.now()}`
  });
});

// Get active stay for a guest
app.get('/api/active-stay/:guestId', (req, res) => {
  const db = readDB();
  const stay = db.stays.find(s => s.guestId == req.params.guestId && s.status === 'active');
  if (!stay) return res.json({ stay: null });
  const room = db.rooms.find(r => r.id === stay.roomId);
  res.json({ stay, room });
});

// Check-out
app.post('/api/checkout', (req, res) => {
  const { guestId, nights, comments } = req.body;
  const db = readDB();
  const stay = db.stays.find(s => s.guestId == guestId && s.status === 'active');
  if (!stay) return res.status(404).json({ error: 'No active stay' });

  const total = nights * stay.roomRate;
  stay.checkoutDate = new Date().toISOString().split('T')[0];
  stay.totalBill = total;
  stay.comments = comments;
  stay.status = 'completed';

  const room = db.rooms.find(r => r.id === stay.roomId);
  if (room) room.available = true;

  writeDB(db);
  res.json({ success: true, bill: total, stay });
});

// Get guest profile (for login)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const guest = db.guests.find(g => g.email === email && g.password === password);
  if (guest) {
    res.json({ success: true, guest });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Get guest by ID
app.get('/api/guest/:id', (req, res) => {
  const db = readDB();
  const guest = db.guests.find(g => g.id == req.params.id);
  res.json(guest);
});

// Update guest profile
app.put('/api/guest/:id', (req, res) => {
  const db = readDB();
  const index = db.guests.findIndex(g => g.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  db.guests[index] = { ...db.guests[index], ...req.body };
  writeDB(db);
  res.json({ success: true, guest: db.guests[index] });
});

// Get stay history for a guest
app.get('/api/history/:guestId', (req, res) => {
  const db = readDB();
  const history = db.stays.filter(s => s.guestId == req.params.guestId && s.status === 'completed');
  res.json(history);
});

// Admin: get all stays
app.get('/api/admin/stays', (req, res) => {
  const db = readDB();
  const staysWithGuest = db.stays.map(stay => {
    const guest = db.guests.find(g => g.id === stay.guestId);
    return { ...stay, guestName: guest ? guest.name : 'Unknown' };
  });
  res.json(staysWithGuest);
});

// Admin: override room assignment
app.post('/api/admin/override-room', (req, res) => {
  const { stayId, newRoomId } = req.body;
  const db = readDB();
  const stay = db.stays.find(s => s.id == stayId);
  const newRoom = db.rooms.find(r => r.id == newRoomId);
  if (!stay || !newRoom || !newRoom.available) {
    return res.status(400).json({ error: 'Invalid override' });
  }
  const oldRoom = db.rooms.find(r => r.id === stay.roomId);
  if (oldRoom) oldRoom.available = true;
  stay.roomId = newRoom.id;
  stay.roomNumber = newRoom.number;
  stay.roomRate = newRoom.rate;
  newRoom.available = false;
  writeDB(db);
  res.json({ success: true });
});

// Signup (create new guest without a stay)
app.post('/api/signup', (req, res) => {
  const { name, email, phone, password, idBase64 } = req.body;
  const db = readDB();
  if (db.guests.find(g => g.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }
  const newGuest = {
    id: Date.now(),
    name,
    email,
    phone,
    password,
    idImage: idBase64
  };
  db.guests.push(newGuest);
  writeDB(db);
  res.json({ success: true, guest: newGuest });
});

const PORT = 5000;
app.post('/api/signup', (req, res) => {
  const { name, email, phone, password, idBase64 } = req.body;
  const db = readDB();
  if (db.guests.find(g => g.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }
  const newGuest = {
    id: Date.now(),
    name, email, phone, password, idImage: idBase64
  };
  db.guests.push(newGuest);
  writeDB(db);
  res.json({ success: true, guest: newGuest });
});
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
app.get('/api/admin/guests', (req, res) => {
  const db = readDB();
  res.json(db.guests);
});
app.get('/api/admin/guests', (req, res) => {
  const db = readDB();
  res.json(db.guests);
});