declare module 'node-imap' {
  class Connection {
    constructor(config: any);
    connect(): void;
    once(event: string, callback: (...args: any[]) => void): void;
    on(event: string, callback: (...args: any[]) => void): void;
    openBox(boxName: string, readOnly: boolean, callback: (err: any, box: any) => void): void;
    search(criteria: any[], callback: (err: any, results: any[]) => void): void;
    fetch(source: any, options: any): any;
    end(): void;
  }
  export default Connection;
}

declare module 'mailparser' {
  export function simpleParser(source: any, options?: any): Promise<any>;
  
  export interface ParsedMail {
    text?: string;
    subject?: string;
    messageId?: string;
  }
}