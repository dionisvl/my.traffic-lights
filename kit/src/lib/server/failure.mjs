export class Failure extends Error { constructor(status, message) { super(message); this.status=status; } }
export const requireThat = (condition,status,message) => { if (!condition) throw new Failure(status,message); };
