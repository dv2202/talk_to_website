/** Tracks which live room the owner currently has open (client-only). */

let selectedRoomId: string | null = null;

export function setLiveOwnerSelectedRoom(roomId: string | null) {
    selectedRoomId = roomId;
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("live-owner-selected-room", { detail: { roomId } })
        );
    }
}

export function getLiveOwnerSelectedRoom(): string | null {
    return selectedRoomId;
}
