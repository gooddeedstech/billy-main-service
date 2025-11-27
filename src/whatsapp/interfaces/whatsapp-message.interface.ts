export interface WhatsAppTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
}

export interface WhatsAppFlowCompletionMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'flow_completion';
  flow: {
    data: Record<string, any>;
  };
}

export type WhatsAppIncomingMessage =
  | WhatsAppTextMessage
  | WhatsAppFlowCompletionMessage;
