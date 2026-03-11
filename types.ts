
export enum Sender {
  User = 'user',
  AI = 'ai',
  System = 'system',
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  attachments?: {
    name: string;
    mimeType: string;
    data: string; // base64
  }[];
}

export interface Source {
  title: string;
  uri: string;
}

export interface Diagnosis {
  name: string;
  probability: number;
  description: string;
  investigations: string[];
  treatment: string;
  sources: Source[];
}

export interface DiagnosisResult {
  diagnoses: Diagnosis[];
}

export enum AppState {
  Initial,
  Loading,
  Chatting,
  Done,
}

export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}
