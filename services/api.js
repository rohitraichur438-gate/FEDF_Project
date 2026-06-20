import axios from 'axios';

const API = 'http://localhost:5000/api';

export const getRooms = () => axios.get(`${API}/rooms`);
export const assignRoom = (preference) => axios.post(`${API}/assign-room`, { preference });
export const checkin = (guest, idBase64, roomId, checkinDate) =>
  axios.post(`${API}/checkin`, { guest, idBase64, roomId, checkinDate });
export const getActiveStay = (guestId) => axios.get(`${API}/active-stay/${guestId}`);
export const checkout = (guestId, nights, comments) =>
  axios.post(`${API}/checkout`, { guestId, nights, comments });
export const login = (email, password) => axios.post(`${API}/login`, { email, password });
export const signup = (data) => axios.post(`${API}/signup`, data);
export const getGuest = (id) => axios.get(`${API}/guest/${id}`);
export const updateGuest = (id, data) => axios.put(`${API}/guest/${id}`, data);
export const getHistory = (guestId) => axios.get(`${API}/history/${guestId}`);
export const getAdminStays = () => axios.get(`${API}/admin/stays`);
export const overrideRoom = (stayId, newRoomId) =>
  axios.post(`${API}/admin/override-room`, { stayId, newRoomId });
export const getAllGuests = () => axios.get(`${API}/admin/guests`);