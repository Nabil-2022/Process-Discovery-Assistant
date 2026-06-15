export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    // Dev-only provider: no SMTP dependency and no secret handling.
    console.info('[email:console]', {
      to: message.to,
      subject: message.subject,
      size: message.text.length,
    });
  }
}

export class MockEmailProvider implements EmailProvider {
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.messages.push(message);
  }
}
