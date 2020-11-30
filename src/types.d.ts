declare var __DEV__: boolean;

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type CliCommand =
  | 'pause'
  | 'play'
  | 'toggle'
  | 'seek'
  | 'next'
  | 'prev'
  | 'stop'
  | 'skipad';

export interface SessionSource {
  tabId: number;
  frameId: number;
}

export interface Session {
  id: string;
  origin: string;
  state: {
    metadata: MediaMetadata | null;
    playbackState: MediaSessionPlaybackState;
  };
  actions: MediaSessionAction[];
  hasBeenPlayed: boolean;
  lastChange: SessionChange;
  lastChangeAt: number;
  tabLastActivatedAt: number;
}

export interface Sessions {
  [id: string]: Session;
}

export interface ActionAdded {
  type: 'action-added';
  action: MediaSessionAction;
}

export interface ActionRemoved {
  type: 'action-removed';
  action: MediaSessionAction;
}

export interface MetadataChanged {
  type: 'metadata-changed';
}

export interface PlaybackStateChanged {
  type: 'playback-state-changed';
}

export type SessionChange =
  | ActionAdded
  | ActionRemoved
  | MetadataChanged
  | PlaybackStateChanged;

export interface RequestSyncMessage {
  action: 'request-sync';
}

export interface SeekAbsoluteMessage {
  tabId: number;
  frameId: number;
  action: 'seekto';
  actionArgs: {
    seekTime: number;
    fastSeek: boolean;
  };
}

export interface SeekRelativeMessage {
  tabId: number;
  frameId: number;
  action: 'seekbackward' | 'seekforward';
  actionArgs: {
    seekOffset: number;
  };
}

export interface SimpleActionMessage {
  tabId: number;
  frameId: number;
  action: 'play' | 'pause' | 'previoustrack' | 'nexttrack' | 'skipad' | 'stop';
  actionArgs: undefined;
}

export type NativeToChromeMessage =
  | RequestSyncMessage
  | SimpleActionMessage
  | SeekAbsoluteMessage
  | SeekRelativeMessage;

export interface NativeSyncMessage {
  type: 'sync';
  sessions: Sessions;
}

export type ChromeToNativeMessage = NativeSyncMessage;

export interface GetFrameIdMessage {
  type: 'get-frame-id';
}

export interface UnloadedMessage {
  type: 'unloaded';
}

export type ContentSyncMessage = Pick<
  Session,
  'state' | 'actions' | 'hasBeenPlayed'
> & {
  type: 'sync';
  change: SessionChange;
};

export type ContentToBackgroundMessage =
  | GetFrameIdMessage
  | UnloadedMessage
  | ContentSyncMessage;

export type BackgroundToContentMessage =
  | SimpleActionMessage
  | SeekAbsoluteMessage
  | SeekRelativeMessage;

export interface InjectedToContentMessage {
  from: 'CMC_INJECTED';
  data: ContentSyncMessage;
}

export interface ContentToInjectedMessage {
  from: 'CMC_CONTENT';
  data: BackgroundToContentMessage;
}
