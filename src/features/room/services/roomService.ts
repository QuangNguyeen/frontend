import { httpClient } from '@/shared/lib/httpClient';
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomResponse,
  RoomSnapshotResponse,
} from '../types/room';

const BASE = '/api/v1/rooms';

export const roomService = {
  async createRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
    const res = await httpClient.post(BASE, data);
    return res.data;
  },

  async joinRoom(roomCode: string): Promise<JoinRoomResponse> {
    const res = await httpClient.post(`${BASE}/${roomCode}/join`);
    return res.data;
  },

  async getRoom(roomCode: string): Promise<RoomSnapshotResponse> {
    const res = await httpClient.get(`${BASE}/${roomCode}`);
    return res.data;
  },

  async closeRoom(roomCode: string): Promise<void> {
    await httpClient.delete(`${BASE}/${roomCode}`);
  },
};
