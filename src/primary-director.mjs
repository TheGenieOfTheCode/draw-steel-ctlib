export const primaryGM = () => game.users.activeGM ?? null;

export const isPrimaryGM = () => !!primaryGM()?.isSelf;

export const executeAsDirector = (socket, handler, ...args) => {
  if (!socket) return Promise.resolve(undefined);
  const gm = primaryGM();
  return gm && !gm.isSelf ? socket.executeAsUser(handler, gm.id, ...args) : socket.executeAsGM(handler, ...args);
};
