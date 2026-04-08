const match = window.location.pathname.match(/^\/game\/([A-Z0-9]+)$/i);

/** Lobby code extracted from the URL path (e.g. /game/ABCD), or null if not a join URL. */
export const pendingLobbyCode: string | null = match ? match[1].toUpperCase() : null;
