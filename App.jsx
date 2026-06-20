import React, { useState, useEffect, useRef } from 'react';
import * as api from './services/api';

function App() {
  const [page, setPage] = useState('login');
  const [guest, setGuest] = useState(null);
  const [activeStay, setActiveStay] = useState(null);
  const [assignedRoom, setAssignedRoom] = useState(null);
  const [digitalKey, setDigitalKey] = useState('');
  const [bill, setBill] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [darkMode, setDarkMode] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signup, setSignup] = useState({ name: '', email: '', phone: '', password: '' });

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [viewFilter, setViewFilter] = useState('all');
  const [rooms, setRooms] = useState([]);

  // Booking ID upload (if not already present)
  const [bookingIdBase64, setBookingIdBase64] = useState('');
  const [showIdUpload, setShowIdUpload] = useState(false);

  const [nights, setNights] = useState(1);
  const [comments, setComments] = useState('');
  const [rating, setRating] = useState(0);
  const [history, setHistory] = useState([]);

  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [allStays, setAllStays] = useState([]);
  const [allGuests, setAllGuests] = useState([]);
  const [overrideData, setOverrideData] = useState({ stayId: '', newRoomId: '' });
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [showIdModal, setShowIdModal] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editGuest, setEditGuest] = useState({ name: '', email: '', phone: '' });

  // Avatar
  const [avatarBase64, setAvatarBase64] = useState('');

  // Door state
  const [doorUnlocked, setDoorUnlocked] = useState(false);
  const [doorAnimation, setDoorAnimation] = useState(false);

  const [totalStays, setTotalStays] = useState(0);
  const [firstStayDate, setFirstStayDate] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // Load saved data
  useEffect(() => {
    const savedGuest = localStorage.getItem('guest');
    if (savedGuest) {
      const g = JSON.parse(savedGuest);
      setGuest(g);
      setAvatarBase64(g.avatar || '');
      loadActiveStay(g.id);
      setPage('home');
      loadGuestStats(g.id);
    }
    fetchRooms();
    const darkPref = localStorage.getItem('darkMode') === 'true';
    setDarkMode(darkPref);
    if (darkPref) document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const fetchRooms = async () => {
    try {
      const res = await api.getRooms();
      setRooms(res.data);
    } catch (err) { console.error(err); }
  };

  const loadActiveStay = async (guestId) => {
    try {
      const res = await api.getActiveStay(guestId);
      if (res.data.stay) {
        setActiveStay(res.data.stay);
        setAssignedRoom(res.data.room);
        if (res.data.stay.digitalKey) setDigitalKey(res.data.stay.digitalKey);
        setDoorUnlocked(false);
      } else {
        setActiveStay(null);
        setAssignedRoom(null);
        setDoorUnlocked(false);
      }
    } catch (err) { console.error(err); }
  };

  const loadGuestStats = async (guestId) => {
    try {
      const res = await api.getHistory(guestId);
      setTotalStays(res.data.length);
      if (res.data.length > 0) setFirstStayDate(res.data[0].checkinDate);
      else setFirstStayDate(new Date().toISOString().split('T')[0]);
    } catch (err) { console.error(err); }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      showToast('Please enter email and password', 'error');
      return;
    }
    try {
      const res = await api.login(loginEmail, loginPassword);
      if (res.data.success) {
        setGuest(res.data.guest);
        setAvatarBase64(res.data.guest.avatar || '');
        localStorage.setItem('guest', JSON.stringify(res.data.guest));
        await loadActiveStay(res.data.guest.id);
        await loadGuestStats(res.data.guest.id);
        setPage('home');
        showToast(`Welcome back, ${res.data.guest.name}!`, 'success');
      }
    } catch (err) {
      showToast('Invalid email or password', 'error');
    }
  };

  const handleSignup = async () => {
    if (!signup.name || !signup.email || !signup.phone || !signup.password) {
      showToast('Please fill all fields', 'error');
      return;
    }
    try {
      const res = await api.signup({ ...signup, idBase64: '' });
      if (res.data.success) {
        showToast('Account created! Please login.', 'success');
        setPage('login');
      }
    } catch (err) {
      showToast('Signup failed (email may exist)', 'error');
    }
  };

  // Booking: check ID requirement
  const prepareBooking = () => {
    if (!guest.idImage && !bookingIdBase64) {
      setShowIdUpload(true);
      showToast('Please upload your government ID to continue', 'info');
    } else {
      handleBookRoom();
    }
  };

  const handleBookRoom = async (idBase64Override = null) => {
    if (!selectedRoomId) {
      showToast('Please select a room', 'error');
      return;
    }
    const selectedRoom = rooms.find(r => r.id === parseInt(selectedRoomId));
    if (!selectedRoom || !selectedRoom.available) {
      showToast('Room not available', 'error');
      return;
    }
    // Use newly uploaded ID if provided, otherwise existing guest ID
    const finalIdBase64 = idBase64Override || guest.idImage || '';
    try {
      const checkinRes = await api.checkin(
        { name: guest.name, email: guest.email, phone: guest.phone },
        finalIdBase64,
        selectedRoom.id,
        new Date().toISOString().split('T')[0]
      );
      if (checkinRes.data.success) {
        // Update guest with new ID if uploaded now
        if (idBase64Override && !guest.idImage) {
          const updatedGuest = { ...guest, idImage: idBase64Override };
          setGuest(updatedGuest);
          localStorage.setItem('guest', JSON.stringify(updatedGuest));
          await api.updateGuest(guest.id, { idImage: idBase64Override });
        }
        setActiveStay(checkinRes.data.stay);
        setAssignedRoom(selectedRoom);
        setDigitalKey(checkinRes.data.digitalKey);
        setDoorUnlocked(false);
        setDoorAnimation(false);
        setShowIdUpload(false);
        setBookingIdBase64('');
        showToast(`Room ${selectedRoom.number} booked!`, 'success');
        setPage('home');
      }
    } catch (err) {
      showToast('Booking failed', 'error');
    }
  };

  const handleCheckout = async () => {
    if (!activeStay) return;
    const finalComments = comments + (rating > 0 ? ` | Rating: ${rating} stars` : '');
    try {
      const res = await api.checkout(guest.id, nights, finalComments);
      if (res.data.success) {
        setBill(res.data.bill);
        setActiveStay(null);
        setAssignedRoom(null);
        setDoorUnlocked(false);
        showToast(`Checked out. Total: $${res.data.bill}`, 'success');
        setPage('history');
        loadHistory();
        loadGuestStats(guest.id);
        // Automatically download PDF invoice after checkout
        setTimeout(() => downloadInvoice(res.data.bill), 500);
      }
    } catch (err) { showToast('Checkout failed', 'error'); }
  };

  const downloadInvoice = (totalAmount = bill) => {
    const html = `
      <html>
        <head><title>Invoice</title><style>body{font-family:sans-serif; padding:2rem;} .invoice{max-width:600px; margin:auto; border:1px solid #e2e8f0; border-radius:1rem; padding:2rem; background:#fff;}</style></head>
        <body><div class="invoice">
          <h1>🏨 Grand Hotel</h1>
          <hr>
          <p><strong>Guest:</strong> ${guest?.name}</p>
          <p><strong>Email:</strong> ${guest?.email}</p>
          <p><strong>Room:</strong> ${activeStay?.roomNumber}</p>
          <p><strong>Check-in:</strong> ${activeStay?.checkinDate}</p>
          <p><strong>Nights:</strong> ${nights}</p>
          <p><strong>Total:</strong> $${totalAmount}</p>
          <hr>
          <p>Thank you for staying with us!</p>
        </div></body>
      </html>`;
    const win = window.open();
    win.document.write(html);
    win.print();
  };

  const loadHistory = async () => {
    if (!guest) return;
    try {
      const res = await api.getHistory(guest.id);
      setHistory(res.data);
    } catch (err) { console.error(err); }
  };

  const handleReBook = (stay) => {
    const room = rooms.find(r => r.number === stay.roomNumber);
    if (room && room.available) {
      setSelectedRoomId(room.id);
      setViewFilter(room.view);
      setPage('book');
      showToast(`Room ${room.number} is available. Confirm booking.`, 'info');
    } else {
      showToast(`Room ${stay.roomNumber} is not available. Choose another.`, 'error');
      setPage('book');
    }
  };

  const loadAdminData = async () => {
    try {
      const staysRes = await api.getAdminStays();
      setAllStays(staysRes.data);
      const guestsRes = await api.getAllGuests();
      setAllGuests(guestsRes.data);
    } catch (err) { console.error(err); }
  };

  const handleAdminLogin = () => {
    if (adminPassword === 'admin123') {
      setAdminLoggedIn(true);
      loadAdminData();
      showToast('Admin access granted', 'success');
    } else {
      showToast('Wrong password', 'error');
    }
  };

  const handleAdminOverride = async () => {
    try {
      await api.overrideRoom(overrideData.stayId, overrideData.newRoomId);
      showToast('Room overridden', 'success');
      loadAdminData();
    } catch (err) { showToast('Override failed', 'error'); }
  };

  const logout = () => {
    localStorage.removeItem('guest');
    setGuest(null);
    setActiveStay(null);
    setAssignedRoom(null);
    setBill(null);
    setDigitalKey('');
    setAdminLoggedIn(false);
    setDoorUnlocked(false);
    setShowIdUpload(false);
    setPage('login');
    showToast('Logged out', 'info');
  };

  const enableEdit = () => {
    setEditGuest({ name: guest.name, email: guest.email, phone: guest.phone });
    setEditMode(true);
  };

  const saveProfile = async () => {
    try {
      const updated = { ...editGuest, avatar: avatarBase64 };
      await api.updateGuest(guest.id, updated);
      const updatedGuest = { ...guest, ...editGuest, avatar: avatarBase64 };
      setGuest(updatedGuest);
      localStorage.setItem('guest', JSON.stringify(updatedGuest));
      setEditMode(false);
      showToast('Profile updated', 'success');
    } catch (err) { showToast('Update failed', 'error'); }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarBase64(reader.result);
      showToast('Avatar updated. Save profile to keep it.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleIdUploadForBooking = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setBookingIdBase64(reader.result);
      showToast('ID uploaded. Now confirm booking.', 'success');
      handleBookRoom(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const occupiedCount = allStays.filter(s => s.status === 'active').length;
  const totalRooms = rooms.length;

  useEffect(() => {
    if (rooms.length) {
      let filtered = rooms.filter(r => r.available === true);
      if (viewFilter !== 'all') filtered = filtered.filter(r => r.view === viewFilter);
      setAvailableRooms(filtered);
      if (filtered.length > 0 && !selectedRoomId) setSelectedRoomId(filtered[0].id);
    }
  }, [rooms, viewFilter]);

  const handleUnlockDoor = () => {
    if (doorUnlocked) return;
    setDoorAnimation(true);
    setTimeout(() => {
      setDoorUnlocked(true);
      setDoorAnimation(false);
      showToast('Door unlocked! Welcome to your room.', 'success');
    }, 300);
  };

  const handleLockDoor = () => {
    setDoorUnlocked(false);
    setDoorAnimation(false);
    showToast('Door locked. Security activated.', 'info');
  };

  const combinedData = allStays.map(stay => {
    const guestInfo = allGuests.find(g => g.id === stay.guestId);
    return {
      ...stay,
      guestName: guestInfo?.name || stay.guestName,
      guestEmail: guestInfo?.email,
      guestPhone: guestInfo?.phone,
      guestIdImage: guestInfo?.idImage
    };
  });

  return (
    <div className={`min-h-screen transition-all duration-300 ${darkMode ? 'dark' : ''}`}>
      {/* Background with hotel icons + animation */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50/90 to-indigo-100/90 dark:from-gray-900 dark:to-gray-800 -z-10 animate-fadeIn">
        <div className="absolute inset-0 opacity-20 dark:opacity-10" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/hotel-wallpaper.png'), url('https://www.transparenttextures.com/patterns/white-diamond.png')", backgroundBlendMode: 'overlay' }}></div>
        <div className="absolute bottom-10 left-10 text-7xl opacity-10 dark:opacity-5 animate-pulse"><i className="fas fa-crown"></i></div>
        <div className="absolute top-20 right-20 text-8xl opacity-10 dark:opacity-5 animate-bounce"><i className="fas fa-umbrella-beach"></i></div>
        <div className="absolute bottom-20 right-32 text-6xl opacity-10 dark:opacity-5 animate-spin-slow"><i className="fas fa-champagne-glasses"></i></div>
        <div className="absolute top-40 left-20 text-5xl opacity-10 dark:opacity-5 animate-pulse"><i className="fas fa-spa"></i></div>
        <div className="absolute bottom-32 left-64 text-7xl opacity-10 dark:opacity-5 animate-bounce"><i className="fas fa-key"></i></div>
        <div className="absolute top-60 right-64 text-6xl opacity-10 dark:opacity-5 animate-pulse"><i className="fas fa-concierge-bell"></i></div>
      </div>

      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 max-w-sm animate-slide-in rounded-lg shadow-lg overflow-hidden ${
          toast.type === 'error' ? 'bg-red-500' : toast.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'
        }`}>
          <div className="px-4 py-3 text-white flex items-center gap-2">
            <i className={`fas ${toast.type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {guest && (
        <nav className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-md sticky top-0 z-40 transition-all">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <i className="fas fa-hotel text-2xl text-blue-600 dark:text-blue-400"></i>
              <span className="font-bold text-xl text-gray-800 dark:text-white">Grand Hotel</span>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => setPage('home')} className="text-gray-700 dark:text-gray-200 hover:text-blue-600 transition transform hover:scale-105">Home</button>
              <button onClick={() => setPage('book')} className="text-gray-700 dark:text-gray-200 hover:text-blue-600 transition transform hover:scale-105">Book Room</button>
              <button onClick={() => setPage('profile')} className="text-gray-700 dark:text-gray-200 hover:text-blue-600 transition transform hover:scale-105">Profile</button>
              {activeStay && <button onClick={() => setPage('checkout')} className="text-gray-700 dark:text-gray-200 hover:text-red-600 transition transform hover:scale-105">Checkout</button>}
              <button onClick={() => { setPage('history'); loadHistory(); }} className="text-gray-700 dark:text-gray-200 hover:text-blue-600 transition transform hover:scale-105">History</button>
              <button onClick={() => setPage('admin')} className="text-gray-700 dark:text-gray-200 hover:text-blue-600 transition transform hover:scale-105">Admin</button>
              <button onClick={logout} className="text-red-600 dark:text-red-400 hover:text-red-800 transition transform hover:scale-105">Logout</button>
              <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 transition transform hover:scale-110">
                <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>
            </div>
          </div>
        </nav>
      )}

      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* LOGIN PAGE (unchanged but with animation) */}
        {page === 'login' && (
          <div className="flex justify-center items-center min-h-[70vh] animate-fadeIn">
            <div className="grid md:grid-cols-2 gap-0 max-w-4xl w-full bg-white/85 dark:bg-gray-800/85 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-blue-700 to-indigo-700 p-8 text-white flex flex-col justify-center items-center text-center">
                <i className="fas fa-hotel text-6xl mb-4 drop-shadow-lg"></i>
                <h2 className="text-3xl font-bold tracking-tight">Grand Hotel</h2>
                <p className="text-blue-100 mt-2">Luxury redefined</p>
                <div className="mt-8 w-full">
                  <p className="text-sm opacity-80">No account yet?</p>
                  <button onClick={() => setPage('signup')} className="mt-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg hover:bg-white/30 transition w-full">Create one →</button>
                </div>
                <div className="mt-8 flex gap-3 text-2xl opacity-50">
                  <i className="fas fa-wifi"></i>
                  <i className="fas fa-swimmer"></i>
                  <i className="fas fa-dumbbell"></i>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Sign In</h3>
                <div className="space-y-4">
                  <input type="email" placeholder="Email" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                  <input type="password" placeholder="Password" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                  <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition transform hover:scale-105">Sign In</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SIGNUP PAGE (unchanged) */}
        {page === 'signup' && (
          <div className="flex justify-center items-center min-h-[70vh] animate-fadeIn">
            <div className="grid md:grid-cols-2 gap-0 max-w-4xl w-full bg-white/85 dark:bg-gray-800/85 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-green-700 to-teal-700 p-8 text-white flex flex-col justify-center items-center text-center">
                <i className="fas fa-user-plus text-6xl mb-4"></i>
                <h2 className="text-3xl font-bold">Join Us</h2>
                <p className="text-green-100 mt-2">Create your account in seconds</p>
                <div className="mt-8 w-full">
                  <p className="text-sm opacity-80">Already a member?</p>
                  <button onClick={() => setPage('login')} className="mt-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg hover:bg-white/30 transition w-full">Sign In →</button>
                </div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Create Account</h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Full Name" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400" onChange={e => setSignup({...signup, name: e.target.value})} />
                  <input type="email" placeholder="Email" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400" onChange={e => setSignup({...signup, email: e.target.value})} />
                  <input type="tel" placeholder="Phone" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400" onChange={e => setSignup({...signup, phone: e.target.value})} />
                  <input type="password" placeholder="Password" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400" onChange={e => setSignup({...signup, password: e.target.value})} />
                  <button onClick={handleSignup} className="w-full bg-green-600 text-white py-2 rounded-lg transition transform hover:scale-105">Sign Up</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HOME PAGE – enhanced animations */}
        {page === 'home' && guest && (
          <div className="animate-fadeIn">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white shadow-lg transform hover:scale-[1.02] transition">
              <h1 className="text-3xl font-bold">Welcome, {guest.name}!</h1>
              <p className="text-blue-100 mt-1">We're delighted to have you at Grand Hotel.</p>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {activeStay && assignedRoom ? (
                  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 transform hover:scale-[1.01] transition">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Your Active Stay</h2>
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <p className="text-gray-500 dark:text-gray-400">Room Number</p>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white">{assignedRoom.number}</p>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">{assignedRoom.type} - {assignedRoom.view} view</p>
                        <p className="text-gray-600 dark:text-gray-300">Rate: ${assignedRoom.rate}/night</p>
                        <p className="text-gray-600 dark:text-gray-300">Check-in: {activeStay.checkinDate}</p>
                      </div>
                      <div className="flex-1">
                        <div className={`relative bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg transition-all duration-500 transform ${doorAnimation ? 'scale-105 rotate-1' : ''} ${doorUnlocked ? 'bg-green-500' : ''} hover:shadow-xl`}>
                          <div className="text-center">
                            <i className={`fas ${doorUnlocked ? 'fa-door-open' : 'fa-door-closed'} text-5xl mb-3 transition-all duration-300 ${doorUnlocked ? 'animate-bounce' : ''}`}></i>
                            <p className="font-bold text-lg">{doorUnlocked ? 'Door Unlocked' : 'Digital Key Ready'}</p>
                            <div className="flex gap-3 justify-center mt-3">
                              {!doorUnlocked ? (
                                <button onClick={handleUnlockDoor} className="bg-white text-amber-600 px-4 py-1 rounded-full font-semibold hover:scale-105 transition">Unlock Door</button>
                              ) : (
                                <button onClick={handleLockDoor} className="bg-gray-800 text-white px-4 py-1 rounded-full font-semibold hover:scale-105 transition">Lock Door</button>
                              )}
                            </div>
                            {!doorUnlocked && digitalKey && <p className="text-xs mt-2 opacity-75">Key: {digitalKey.slice(-8)}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 text-center">
                    <i className="fas fa-bed text-5xl text-gray-400 mb-3"></i>
                    <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">No Active Stay</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">You haven't booked a room yet.</p>
                    <button onClick={() => setPage('book')} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition transform hover:scale-105">Book a Room Now</button>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 text-center hover:scale-105 transition">
                  <i className="fas fa-building text-2xl text-blue-500 mb-1"></i>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalRooms}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Rooms</p>
                </div>
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 text-center hover:scale-105 transition">
                  <i className="fas fa-user-check text-2xl text-green-500 mb-1"></i>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{occupiedCount}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Currently Occupied</p>
                </div>
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 text-center hover:scale-105 transition">
                  <i className="fas fa-chart-line text-2xl text-purple-500 mb-1"></i>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalStays}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your Total Stays</p>
                </div>
              </div>
            </div>
            <div className="mt-10">
              <h2 className="text-2xl font-bold mb-5 text-gray-800 dark:text-white">Hotel Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { icon: "fa-swimming-pool", name: "Infinity Pool", desc: "Heated rooftop pool" },
                  { icon: "fa-dumbbell", name: "Fitness Center", desc: "24/7 modern gym" },
                  { icon: "fa-spa", name: "Luxury Spa", desc: "Full-service treatments" },
                  { icon: "fa-utensils", name: "Fine Dining", desc: "3 restaurants" },
                  { icon: "fa-wifi", name: "High-Speed WiFi", desc: "Complimentary" },
                  { icon: "fa-concierge-bell", name: "Concierge", desc: "24/7 assistance" }
                ].map((a, idx) => (
                  <div key={idx} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 text-center hover:shadow-lg transition transform hover:scale-105">
                    <i className={`fas ${a.icon} text-3xl text-blue-500 mb-2`}></i>
                    <p className="font-semibold text-gray-800 dark:text-white">{a.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BOOK ROOM PAGE – with ID upload if needed */}
        {page === 'book' && guest && (
          <div className="max-w-4xl mx-auto animate-fadeIn">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Book a Room</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Choose your preferred view and select an available room.</p>
              {showIdUpload && !guest.idImage && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200">
                  <label className="block font-medium text-gray-700 dark:text-gray-300">Government ID Required</label>
                  <input type="file" accept="image/*,application/pdf" onChange={handleIdUploadForBooking} className="mt-2 w-full border rounded p-2" />
                  <p className="text-xs text-gray-500 mt-1">Please upload your ID to complete booking.</p>
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">View Preference</label>
                  <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={viewFilter} onChange={e => setViewFilter(e.target.value)}>
                    <option value="all">All Rooms</option>
                    <option value="ocean">Ocean View 🌊 (101-110)</option>
                    <option value="city">City View 🌆 (201-210)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select a Room</label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {availableRooms.map(room => (
                      <div 
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`border rounded-xl p-3 cursor-pointer transition-all transform hover:scale-105 ${selectedRoomId == room.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-lg text-gray-800 dark:text-white">Room {room.number}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{room.type} • {room.view} view</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600 dark:text-blue-400">${room.rate}</p>
                            <p className="text-xs text-gray-500">/night</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {availableRooms.length === 0 && <p className="text-red-500 text-sm mt-2">No rooms available for this view.</p>}
                </div>
                <button onClick={prepareBooking} disabled={showIdUpload && !guest.idImage && !bookingIdBase64} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition transform hover:scale-105 disabled:opacity-50">Confirm Booking</button>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE PAGE – with avatar upload */}
        {page === 'profile' && guest && (
          <div className="max-w-3xl mx-auto animate-fadeIn">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl">
              <div className="flex items-center space-x-4 border-b pb-4 mb-4">
                <div className="relative">
                  {avatarBase64 ? (
                    <img src={avatarBase64} className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" alt="avatar" />
                  ) : (
                    <i className="fas fa-user-circle text-5xl text-blue-500"></i>
                  )}
                  {editMode && (
                    <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1 cursor-pointer hover:bg-blue-700">
                      <i className="fas fa-camera text-white text-xs"></i>
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">My Profile</h2>
                  <p className="text-gray-500 dark:text-gray-400">Manage your personal information</p>
                </div>
                {!editMode && <button onClick={enableEdit} className="ml-auto bg-blue-100 dark:bg-blue-900 text-blue-600 px-3 py-1 rounded-lg transition hover:scale-105">Edit</button>}
              </div>
              {editMode ? (
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label><input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={editGuest.name} onChange={e => setEditGuest({...editGuest, name: e.target.value})} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label><input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={editGuest.email} onChange={e => setEditGuest({...editGuest, email: e.target.value})} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label><input className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={editGuest.phone} onChange={e => setEditGuest({...editGuest, phone: e.target.value})} /></div>
                  <div className="flex gap-2">
                    <button onClick={saveProfile} className="bg-green-600 text-white px-4 py-2 rounded-lg transition hover:scale-105">Save Changes</button>
                    <button onClick={() => setEditMode(false)} className="bg-gray-400 text-white px-4 py-2 rounded-lg transition hover:scale-105">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div><p className="text-gray-500 dark:text-gray-400">Full Name</p><p className="font-medium text-gray-800 dark:text-white">{guest.name}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Email Address</p><p className="font-medium text-gray-800 dark:text-white">{guest.email}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Phone Number</p><p className="font-medium text-gray-800 dark:text-white">{guest.phone}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">First Stay</p><p className="font-medium text-gray-800 dark:text-white">{firstStayDate}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Total Stays</p><p className="font-medium text-gray-800 dark:text-white">{totalStays}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">ID Document</p>
                    {guest.idImage && (guest.idImage.startsWith('data:image') ? <img src={guest.idImage} className="w-24 rounded border" alt="ID" /> : <div>PDF uploaded</div>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHECKOUT PAGE – with auto PDF trigger */}
        {page === 'checkout' && activeStay && (
          <div className="max-w-2xl mx-auto animate-fadeIn">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Express Checkout</h2>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4">
                <p><span className="font-semibold text-gray-800 dark:text-white">Room {activeStay.roomNumber}</span> - ${activeStay.roomRate}/night</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Check-in date: {activeStay.checkinDate}</p>
              </div>
              <div className="space-y-4">
                <div><label className="block font-medium text-gray-700 dark:text-gray-300">Number of nights stayed</label><input type="number" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={nights} onChange={e => setNights(e.target.value)} min="1" /></div>
                <div><label className="block font-medium text-gray-700 dark:text-gray-300">Your rating for this stay</label>
                  <div className="flex gap-2 text-2xl">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} type="button" onClick={() => setRating(star)} className={`focus:outline-none transition transform hover:scale-110 ${star <= rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="block font-medium text-gray-700 dark:text-gray-300">Comments (optional)</label><textarea rows="2" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" onChange={e => setComments(e.target.value)}></textarea></div>
                <button onClick={handleCheckout} className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition transform hover:scale-105">Confirm Checkout</button>
                {bill && <div className="mt-4 bg-green-50 dark:bg-green-900/30 p-4 rounded-lg text-center"><p className="text-lg font-bold text-gray-800 dark:text-white">Total: ${bill}</p><button onClick={() => downloadInvoice(bill)} className="mt-2 bg-blue-600 text-white px-4 py-1 rounded-lg hover:bg-blue-700 transition transform hover:scale-105">Download Invoice PDF</button></div>}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY PAGE – with re-book button */}
        {page === 'history' && guest && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl animate-fadeIn">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Stay History</h2>
            {history.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">No past stays yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="p-3 text-left text-gray-800 dark:text-white">Room</th>
                      <th className="p-3 text-left text-gray-800 dark:text-white">Check-in</th>
                      <th className="p-3 text-left text-gray-800 dark:text-white">Check-out</th>
                      <th className="p-3 text-left text-gray-800 dark:text-white">Total</th>
                      <th className="p-3 text-left text-gray-800 dark:text-white">Rating</th>
                      <th className="p-3 text-left text-gray-800 dark:text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(s => (
                      <tr key={s.id} className="border-b dark:border-gray-700">
                        <td className="p-3 font-medium text-gray-800 dark:text-white">{s.roomNumber}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{s.checkinDate}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{s.checkoutDate || '-'}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">${s.totalBill}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{s.comments?.includes('Rating:') ? s.comments.match(/Rating: (\d+)/)?.[1] : '-'}★</td>
                        <td className="p-3">
                          <button onClick={() => handleReBook(s)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition transform hover:scale-105">
                            <i className="fas fa-redo-alt mr-1"></i> Re-book
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ADMIN PAGE – with ID monitoring (view ID button) */}
        {page === 'admin' && (
          <div className="max-w-6xl mx-auto animate-fadeIn">
            {!adminLoggedIn ? (
              <div className="max-w-md mx-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Admin Login</h2>
                <input type="password" placeholder="Password" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 mb-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
                <button onClick={handleAdminLogin} className="w-full bg-purple-600 text-white py-2 rounded-lg transition transform hover:scale-105">Login</button>
                <p className="text-xs text-gray-500 mt-2">Hint: admin123</p>
              </div>
            ) : (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Admin Dashboard</h2>
                  <button onClick={loadAdminData} className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition transform hover:scale-105">Refresh</button>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-3 text-center rounded"><p className="text-2xl font-bold text-gray-800 dark:text-white">{totalRooms}</p><p className="text-gray-600 dark:text-gray-300">Total Rooms</p></div>
                  <div className="bg-green-100 dark:bg-green-900/50 p-3 text-center rounded"><p className="text-2xl font-bold text-gray-800 dark:text-white">{occupiedCount}</p><p className="text-gray-600 dark:text-gray-300">Occupied</p></div>
                  <div className="bg-amber-100 dark:bg-amber-900/50 p-3 text-center rounded"><p className="text-2xl font-bold text-gray-800 dark:text-white">{allStays.length}</p><p className="text-gray-600 dark:text-gray-300">Total Stays</p></div>
                  <div className="bg-purple-100 dark:bg-purple-900/50 p-3 text-center rounded"><p className="text-2xl font-bold text-gray-800 dark:text-white">{allGuests.length}</p><p className="text-gray-600 dark:text-gray-300">Total Guests</p></div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded mb-6">
                  <h3 className="font-bold text-gray-800 dark:text-white">Manual Room Override</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <input placeholder="Stay ID" className="border border-gray-300 dark:border-gray-600 p-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onChange={e => setOverrideData({...overrideData, stayId: e.target.value})} />
                    <input placeholder="New Room ID (1-20)" className="border border-gray-300 dark:border-gray-600 p-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" onChange={e => setOverrideData({...overrideData, newRoomId: e.target.value})} />
                    <button onClick={handleAdminOverride} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition transform hover:scale-105">Override</button>
                  </div>
                </div>
                <h3 className="font-bold mb-2 text-gray-800 dark:text-white">All Stays & Guests (Combined)</h3>
                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-gray-800 dark:text-white">Stay ID</th>
                        <th className="p-2 text-left text-gray-800 dark:text-white">Guest Name</th>
                        <th className="p-2 text-left text-gray-800 dark:text-white">Email</th>
                        <th className="p-2 text-left text-gray-800 dark:text-white">Phone</th>
                        <th className="p-2 text-left text-gray-800 dark:text-white">Room</th>
                        <th className="p-2 text-left text-gray-800 dark:text-white">ID Uploaded</th>
                        <th className="p-2 text-left text-gray-800 dark:text-white">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedData.map(item => (
                        <tr key={item.id} className="border-b dark:border-gray-700">
                          <td className="p-2 text-gray-800 dark:text-gray-200">{item.id}</td>
                          <td className="p-2 font-medium text-gray-800 dark:text-white">{item.guestName}</td>
                          <td className="p-2 text-gray-600 dark:text-gray-300">{item.guestEmail || '-'}</td>
                          <td className="p-2 text-gray-600 dark:text-gray-300">{item.guestPhone || '-'}</td>
                          <td className="p-2 text-gray-800 dark:text-white">{item.roomNumber}</td>
                          <td className="p-2">
                            {item.guestIdImage ? (
                              <button
                                onClick={() => {
                                  setSelectedGuestId(item.guestId);
                                  setShowIdModal(true);
                                }}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                <i className="fas fa-id-card"></i> View ID
                              </button>
                            ) : (
                              <span className="text-red-500"><i className="fas fa-times-circle"></i> No</span>
                            )}
                            </td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>
                              {item.status}
                            </span>
                            </td>
                          </tr>
                      ))}
                      {combinedData.length === 0 && (
                        <tr><td colSpan="7" className="text-center p-4 text-gray-500">No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ID Modal for Admin */}
      {showIdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn" onClick={() => setShowIdModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Guest ID Document</h3>
              <button onClick={() => setShowIdModal(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
            {(() => {
              const guestIdDoc = allGuests.find(g => g.id === selectedGuestId)?.idImage;
              if (!guestIdDoc) return <p className="text-gray-500">No ID uploaded.</p>;
              if (guestIdDoc.startsWith('data:image')) {
                return <img src={guestIdDoc} alt="ID" className="w-full rounded border" />;
              } else {
                return <p className="text-sm">PDF document uploaded. <a href={guestIdDoc} download="guest_id.pdf" className="text-blue-600 underline">Download</a></p>;
              }
            })()}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default App;