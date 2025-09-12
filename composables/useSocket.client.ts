export type ClientSocket = ReturnType<typeof useSocket>['socket']

const _socket = shallowRef<any | null>(null)
const _role = shallowRef<'p1' | 'p2' | null>(null)

export function useSocket() {
  function connect() {
    if (_socket.value) return _socket.value
    const io = (window as any).io || (globalThis as any).io
    if (!io) return null
    const config = useRuntimeConfig()
    const url = (config.public as any).wsUrl || 'http://localhost:4000'
    _socket.value = io(url, { path: '/socket.io', transports: ['websocket'] })
    return _socket.value
  }
  function disconnect() {
    _socket.value?.disconnect()
    _socket.value = null
    _role.value = null
  }
  return { socket: _socket, role: _role, connect, disconnect }
}

export function ensurePlayerId(): string {
  const key = 'player_id'
  let id = sessionStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id) }
  return id
}
